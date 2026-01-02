const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const upload = multer({ dest: "uploads/" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const GITHUB_OWNER = "MonstaStudios";
const GITHUB_REPO = "monsta_pipeline_issues";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Or user's token from OAuth

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/api/report", upload.array("images"), async (req, res) => {
  const {
    name, employment, pc_number, department, tool, subtool,
    type, summary, details, extra, contact
  } = req.body;
  let imagesMarkdown = "";
  try {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, { resource_type: "image" });
        imagesMarkdown += `![screenshot](${result.secure_url})\n`;
      }
    }
    const title = `[${type}] ${summary}`;
    const body = 
      `**Name:** ${name}\n` +
      `**In-house/Outsource:** ${employment}\n` +
      `**PC Number:** ${pc_number}\n` +
      `**Department:** ${department}\n` +
      `**Tool:** ${tool}\n` +
      (subtool ? `**Sub-tool:** ${subtool}\n` : "") +
      `\n**Details:**\n${details}\n` +
      (extra ? `\n**Steps/Motivation:**\n${extra}\n` : "") +
      (imagesMarkdown ? `\n**Images:**\n${imagesMarkdown}\n` : "") +
      (contact ? `\n**Contact:** ${contact}\n` : "") +
      `\n_Submitted externally${contact ? '' : ', no contact info provided.'}_`;

    const labels = [type.toLowerCase()];
    if (tool) labels.push(tool);
    if (department) labels.push(department);
    labels.push("external-report");

    await axios.post(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
      { title, body, labels },
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}` } }
    );
    res.status(200).send("Issue submitted!");
  } catch (err) {
    res.status(500).send("Failed to submit issue: " + err.message);
  }
});