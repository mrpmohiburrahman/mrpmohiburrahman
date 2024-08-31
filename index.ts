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
const AVOID_REPOS = [
	"mrpmohiburrahman/tjip-leetcode-repo",
	"firstcontributions/first-contributions",
]; // Specify repositories to avoid here
const MIN_STARS = undefined; // Set this to a number to filter by stars, or leave undefined to include all
const INCLUDE_MERGE_DATE = false; // Toggle this variable to include or exclude the "merged on" date
const MAX_ITEMS = undefined; // Set this to a number to limit items, or leave undefined to include all

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

async function getRepoStars(owner: string, repo: string) {
	try {
		const response = await axios.get(
			`https://api.github.com/repos/${owner}/${repo}`,
			{
				headers: {
					Authorization: `token ${GH_TOKEN}`,
				},
			},
		);

		return response.data.stargazers_count;
	} catch (error) {
		console.error(`Error fetching stars for ${owner}/${repo}:`, error);
		return 0; // Default to 0 if there's an error
	}
}

async function formatMergedPRs(prs: any[]) {
	const formattedPRs = await Promise.all(
		prs.map(async (pr) => {
			const repoUrlParts = pr.repository_url.split("/");
			const repoOwner = repoUrlParts[repoUrlParts.length - 2]; // Extracts the repository owner
			const repoName = repoUrlParts[repoUrlParts.length - 1]; // Extracts the repository name
			const repoFullName = `${repoOwner}/${repoName}`; // Formats the full repository name

			// Check if the repository is in the avoid list
			if (AVOID_REPOS.includes(repoFullName)) {
				return null; // Skip this PR
			}

			const stars = await getRepoStars(repoOwner, repoName); // Fetch the star count

			// Check if the repository has more stars than the specified minimum, if MIN_STARS is defined
			if (MIN_STARS !== undefined && stars < MIN_STARS) {
				return null; // Skip this PR if it doesn't meet the star requirement
			}

			const prNumber = pr.number;
			const prTitle = pr.title;
			const prUrl = pr.html_url;
			const repoUrl = `https://github.com/${repoOwner}/${repoName}`; // Constructs the full repository URL

			// Conditionally include the merge date based on INCLUDE_MERGE_DATE
			const mergedAtText = INCLUDE_MERGE_DATE
				? ` (merged on ${new Date(pr.closed_at).toLocaleDateString()})`
				: "";

			return `1. 🎉 Merged PR: [${prTitle} #${prNumber}](${prUrl}) in **[${repoFullName}](${repoUrl})** ⭐${stars}${mergedAtText}`;
		}),
	);

	// Filter out nulls and limit the number of items if MAX_ITEMS is defined
	const filteredPRs = formattedPRs.filter((pr) => pr !== null);
	return MAX_ITEMS !== undefined
		? filteredPRs.slice(0, MAX_ITEMS).join("\n")
		: filteredPRs.join("\n");
}

function updateReadme(mergedPRsContent: string) {
	const readmeContent = fs.readFileSync(README_PATH, "utf-8");
	const newContent = readmeContent.replace(
		/<!--START_SECTION:merged-prs-->.*<!--END_SECTION:merged-prs-->/s,
		`<!--START_SECTION:merged-prs-->\n${mergedPRsContent}\n<!--END_SECTION:merged-prs-->`,
	);
	fs.writeFileSync(README_PATH, newContent, "utf-8");
}

async function main() {
	const mergedPRs = await getMergedPRs();

	if (mergedPRs.length > 0) {
		const mergedPRsContent = await formatMergedPRs(mergedPRs);
		updateReadme(mergedPRsContent);

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
			sha: sha!,
		});
	}
}

main().catch((error) => {
	console.error("Error updating README:", error);
});
