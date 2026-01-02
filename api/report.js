const AWS = require('aws-sdk');
const axios = require('axios');
const Busboy = require('busboy');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

function getFormFields(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers }); // NOT `new Busboy`
    const fields = {};
    const files = [];
    busboy.on('field', (key, value) => { fields[key] = value; });
    busboy.on('file', (key, file, filename, encoding, mimeType) => {
      let buf = [];
      file.on('data', (data) => buf.push(data));
      file.on('end', () => {
        files.push({ field: key, file: Buffer.concat(buf), filename, mimeType });
      });
    });
    busboy.on('finish', () => resolve({ fields, files }));
    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

async function uploadFileToS3(file, filename, mimeType) {
  const bucketName = process.env.S3_BUCKET_NAME;
  const key = `uploads/${Date.now()}-${filename}`;
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: file,
    ContentType: mimeType,
    ACL: 'public-read' // allows public access to the uploaded image
  };
  const uploadRes = await s3.upload(params).promise();
  return uploadRes.Location; // This is the public URL
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const { fields, files } = await getFormFields(req);

    // Tool: use tool_custom if provided
    const toolVal = (fields.tool === "Other" && fields.tool_custom)
      ? fields.tool_custom
      : fields.tool;

    // Upload images to S3 and collect URLs
    let imagesMarkdown = "";
    for (const uploaded of files) {
      const url = await uploadFileToS3(
        uploaded.file, uploaded.filename, uploaded.mimeType
      );
      imagesMarkdown += `![${uploaded.filename}](${url})\n`;
    }

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

    const labels = [fields.type.toLowerCase()];
    if (toolVal) labels.push(toolVal);
    if (fields.department) labels.push(fields.department);
    labels.push("external-report");

    // Create issue in GitHub
    const ghResp = await axios.post(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/issues`,
      { title: `[${fields.type}] ${fields.summary || 'No summary'}`, body: bodyMd, labels },
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ success: true, issueUrl: ghResp.data.html_url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }

};
