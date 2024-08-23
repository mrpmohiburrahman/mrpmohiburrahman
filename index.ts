import axios from "axios";
import * as fs from "node:fs";
import * as path from "node:path";
import { Octokit } from "@octokit/rest";
import "dotenv/config";

const GH_TOKEN = process.env.GH_TOKEN || "";
const USER = "mrpmohiburrahman";
const REPO = "mrpmohiburrahman";
const README_PATH = path.join(__dirname, "README.md");
const COMMIT_MESSAGE = "Updated README with latest merged PR info";

const octokit = new Octokit({
	auth: GH_TOKEN,
});

async function getMergedPRs() {
	try {
		const response = await axios.get(
			`https://api.github.com/search/issues?q=author:${USER}+type:pr+is:merged&sort=updated&order=desc`,
			{
				headers: {
					Authorization: `token ${GH_TOKEN}`,
				},
			},
		);

		return response.data.items;
	} catch (error) {
		console.error("Error fetching merged PRs:", error);
		return [];
	}
}

function updateReadme(latestPrTitle: string, latestPrUrl: string) {
	const readmeContent = fs.readFileSync(README_PATH, "utf-8");
	const newContent = readmeContent.replace(
		/<!--START_SECTION:merged-prs-->.*<!--END_SECTION:merged-prs-->/s,
		`<!--START_SECTION:merged-prs-->\n- [${latestPrTitle}](${latestPrUrl})\n<!--END_SECTION:merged-prs-->`,
	);
	fs.writeFileSync(README_PATH, newContent, "utf-8");
}

async function main() {
	const mergedPRs = await getMergedPRs();

	if (mergedPRs.length > 0) {
		const latestPr = mergedPRs[0];
		console.log("🚀 ~ main ~ latestPr:", latestPr);
		updateReadme(latestPr.title, latestPr.html_url);

		const contentResponse = await octokit.repos.getContent({
			owner: USER,
			repo: REPO,
			path: "README.md",
		});

		let sha: string | undefined;

		if (!Array.isArray(contentResponse.data) && contentResponse.data.sha) {
			sha = contentResponse.data.sha;
		} else {
			throw new Error("Unexpected response type, expected a single file.");
		}

		await octokit.repos.createOrUpdateFileContents({
			owner: USER,
			repo: REPO,
			path: "README.md",
			message: COMMIT_MESSAGE,
			content: Buffer.from(fs.readFileSync(README_PATH, "utf-8")).toString(
				"base64",
			),

			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			sha: sha!,
		});
	}
}

main().catch((error) => {
	console.error("Error updating README:", error);
});
