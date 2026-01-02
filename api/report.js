const AWS = require('aws-sdk');
const axios = require('axios');
const Busboy = require('busboy');

// S3 client setup
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Sanitize filename to remove unwanted characters, paths, spaces, etc.
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== "string") return "upload.bin";
    return filename
        .replace(/^.*[\\/]/, '')            // Remove directory paths
        .replace(/\s+/g, '_')               // Spaces to underscores
        .replace(/[^a-zA-Z0-9._-]/g, '')    // Only safe characters
        .replace(/\.+/g, '.')               // Reduce consecutive dots
        .toLowerCase();
}

// Guess MIME type from filename (if Busboy doesn't supply image/* correctly)
function guessContentType(filename) {
    filename = sanitizeFilename(String(filename)); // Defensive: always a string
    if (filename.endsWith('.png')) return 'image/png';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
    if (filename.endsWith('.gif')) return 'image/gif';
    if (filename.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
}

// Parse multipart form data (returns { fields, files[] })
function getFormFields(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        const files = [];
        busboy.on('field', (key, value) => { fields[key] = value; });
        busboy.on('file', (key, file, filename, encoding, mimeType) => {
            let buf = [];
            file.on('data', (data) => buf.push(data));
            file.on('end', () => {
                files.push({
                    field: key,
                    filename: filename ? sanitizeFilename(filename) : "upload.bin",
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

// Upload file to S3 & return public URL
async function uploadFileToS3(file, filename, mimeType) {
    const bucketName = process.env.S3_BUCKET_NAME;
    const safeFilename = sanitizeFilename(filename);
    const key = `uploads/${Date.now()}-${safeFilename}`;
    // Prefer mimeType from Busboy only if it's image/*
    const contentType =
        (mimeType && typeof mimeType === "string" && mimeType.startsWith("image/"))
            ? mimeType
            : guessContentType(safeFilename);

    const params = {
        Bucket: bucketName,
        Key: key,
        Body: file,
        ContentType: contentType
        // No ACL needed: bucket policy handles public-read
    };
    const uploadRes = await s3.upload(params).promise();
    return uploadRes.Location;
}

module.exports = async (req, res) => {
    // Optional: allow CORS for external form POSTs (e.g., GitHub Pages)
    // res.setHeader("Access-Control-Allow-Origin", "https://monstastudios.github.io");
    // res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    // if (req.method === "OPTIONS") { res.status(200).end(); return; }

    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }

    try {
        const { fields, files } = await getFormFields(req);

        // Set tool value from custom field if applicable
        const toolVal = (fields.tool === "Other" && fields.tool_custom)
            ? fields.tool_custom
            : fields.tool;

        // Upload images to S3 and collect markdown URLs
        let imagesMarkdown = "";
        for (const uploaded of files) {
            const url = await uploadFileToS3(
                uploaded.file,
                uploaded.filename,
                uploaded.mimeType
            );
            imagesMarkdown += `![${uploaded.filename}](${url})\n`;
        }

        // Build the issue markdown body
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

        // Gather labels for GH issue
        const labels = [
            fields.type ? fields.type.toLowerCase() : "",
            toolVal || "",
            fields.department || "",
            "external-report"
        ].filter(Boolean);

        // Create issue on GitHub
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
        // Optional: print error to Vercel logs
        console.error(err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};
