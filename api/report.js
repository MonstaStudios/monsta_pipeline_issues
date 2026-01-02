const AWS = require('aws-sdk');
const axios = require('axios');
const Busboy = require('busboy');

// AWS S3 Client
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Sanitize filename so it is safe for URL/S3/markdown
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== "string") return "upload.bin";
    return filename
        .replace(/^.*[\\/]/, '')            // Remove path info
        .replace(/\s+/g, '_')               // Spaces to underscore
        .replace(/[^a-zA-Z0-9._-]/g, '')    // Only safe chars
        .replace(/\.+/g, '.')               // Reduce multiple dots
        .toLowerCase();
}

// Guess the image Content-Type by extension (for fallback)
function guessContentType(filename) {
    filename = String(filename || '').toLowerCase();
    if (filename.endsWith('.png'))   return 'image/png';
    if (filename.endsWith('.jpg'))   return 'image/jpeg';
    if (filename.endsWith('.jpeg'))  return 'image/jpeg';
    if (filename.endsWith('.gif'))   return 'image/gif';
    if (filename.endsWith('.webp'))  return 'image/webp';
    return 'application/octet-stream';
}

// Parse form fields/files using Busboy
function getFormFields(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        const files = [];
        busboy.on('field', (key, value) => { fields[key] = value; });
        busboy.on('file', (key, file, info) => {
            // Busboy v1.x+ provides filename, encoding, mimeType in an info object
            const { filename, encoding, mimeType } = info;
            console.log(`Received file: field="${key}", filename="${filename}", mimeType="${mimeType}"`);
            
            let name = 'upload.bin';
            if (filename && typeof filename === 'string' && filename.length > 0) {
                name = sanitizeFilename(filename);
            }
            let buf = [];
            file.on('data', (data) => buf.push(data));
            file.on('end', () => {
                console.log(`File buffered: ${name}, size: ${Buffer.concat(buf).length} bytes`);
                files.push({
                    field: key,
                    filename: name,
                    file: Buffer.concat(buf),
                    mimeType: mimeType
                });
            });
        });
        busboy.on('finish', () => resolve({ fields, files }));
        busboy.on('error', reject);
        req.pipe(busboy);
    });
}

// Upload file to S3 with correct Content-Type
async function uploadFileToS3(file, filename, mimeType) {
    const bucketName = process.env.S3_BUCKET_NAME;
    const safeFilename = sanitizeFilename(filename);
    const key = `uploads/${Date.now()}-${safeFilename}`;
    // Use mimeType only if it's an image, else guess
    const contentType = (
        mimeType && typeof mimeType === "string" && mimeType.startsWith("image/")
    ) ? mimeType : guessContentType(safeFilename);

    // Debug log - see what will be set in S3 metadata
    console.log(`Uploading to S3: ${key}, Content-Type: ${contentType}`);

    const params = {
        Bucket: bucketName,
        Key: key,
        Body: file,
        ContentType: contentType
        // No ACL needed
    };
    const uploadRes = await s3.upload(params).promise();
    return uploadRes.Location;
}

module.exports = async (req, res) => {
    // Optional: allow CORS if submitting from GitHub Pages
    // res.setHeader("Access-Control-Allow-Origin", "https://monstastudios.github.io");
    // res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    // if (req.method === "OPTIONS") { res.status(200).end(); return; }

    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }

    try {
        const { fields, files } = await getFormFields(req);
        
        console.log(`Form parsed - Fields: ${Object.keys(fields).length}, Files: ${files.length}`);
        files.forEach((f, i) => console.log(`  File ${i + 1}: ${f.filename} (${f.mimeType})`));

        // Tool value (custom if "Other" selected)
        const toolVal = (fields.tool === "Other" && fields.tool_custom)
            ? fields.tool_custom
            : fields.tool;

        // Upload each image, assemble markdown
        let imagesMarkdown = "";
        if (files.length > 0) {
            console.log(`Processing ${files.length} image(s)...`);
        }
        for (const uploaded of files) {
            const url = await uploadFileToS3(
                uploaded.file,
                uploaded.filename,
                uploaded.mimeType
            );
            imagesMarkdown += `![${uploaded.filename}](${url})\n`;
        }

        // Build GitHub issue body (markdown)
        const bodyMd = `
**Name:** ${fields.name}
**In-house/Outsource:** ${fields.employment}
**PC Number:** ${fields.pc_number}
**Department:** ${fields.department}
**Tool:** ${toolVal}
${fields.subtool ? `**Sub-tool:** ${fields.subtool}` : ""}
${fields.contact ? `**Contact:** ${fields.contact}\n` : ""}
**Details:**\n${fields.details}
${fields.extra ? `\n**Steps/Motivation:**\n${fields.extra}` : ""}
${imagesMarkdown ? `\n**Images:**\n${imagesMarkdown}` : ""}
_Submitted via external form_
`.trim();

        // Labels for the issue (no empty/undefined values)
        const labels = [
            fields.type ? fields.type.toLowerCase() : "",
            toolVal || "",
            fields.department || "",
            "external-report"
        ].filter(Boolean);

        // Create GitHub issue
        const ghResp = await axios.post(
            `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/issues`,
            {
                title: `[${fields.type}] ${fields.summary || 'No summary'}`,
                body: bodyMd,
                labels
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                    Accept: "application/vnd.github+json"
                }
            }
        );

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ success: true, issueUrl: ghResp.data.html_url });
    } catch (err) {
        // Debug log for error
        console.error(err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};
