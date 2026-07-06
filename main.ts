import { file } from "bun";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const harFilePath = path.join(__dirname, "discord.har");
const harData = JSON.parse(await file(harFilePath).text());

const urls = new Set<string>();
harData.log.entries.forEach((entry: any) => urls.add(entry.request.url));

console.log(`Downloading ${urls.size} files...`);

const downloadsDir = path.join(__dirname, "downloads");
await Bun.write(path.join(downloadsDir, '.keep'), '');

async function getUniquePath(fileName: string): Promise<string> {
	const ext = path.extname(fileName);
	const base = path.basename(fileName, ext);
	let counter = 1;
	let newName = fileName;
	let fullPath = path.join(downloadsDir, newName);
	
	while (await file(fullPath).exists()) {
		newName = `${base} (${counter})${ext}`;
		fullPath = path.join(downloadsDir, newName);
		counter++;
	}
	return fullPath;
}

// Force timeout using Promise.race
function downloadWithForceTimeout(url: string, timeoutMs: number): Promise<void> {
	return Promise.race([
		(async () => {
			const cleanUrl = url.split('?')[0];
			let fileName = path.basename(cleanUrl);
			
			if (fileName === "mp4" || !fileName || fileName === path.extname(fileName)) {
				const hash = Buffer.from(url).toString('base64').slice(-8).replace(/[^a-zA-Z0-9]/g, '');
				const ext = path.extname(cleanUrl) || '.bin';
				fileName = `${hash}${ext}`;
			}
			
			const filePath = await getUniquePath(fileName);
			const response = await fetch(url, {
				headers: { 'User-Agent': 'Mozilla/5.0' }
			});
			
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			await Bun.write(filePath, response);
		})(),
		new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
	]);
}

// Download sequentially with forced timeouts
const urlArray = Array.from(urls);
let completed = 0;
let skipped = 0;

for (let i = 0; i < urlArray.length; i++) {
	try {
		await downloadWithForceTimeout(urlArray[i], 1000);
		completed++;
	} catch {
		skipped++;
	}
	
	// Update progress 
	process.stdout.write(`\r✅ ${completed} | ⏭️ ${skipped} | ${i + 1}/${urlArray.length}`);
}

console.log(`\n✅ Done! Downloaded ${completed}, Skipped ${skipped} files`);
