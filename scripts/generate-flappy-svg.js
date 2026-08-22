// scripts/generate-flappy-svg.js
// Fetches the real GitHub contribution calendar for `github_user_name` and
// renders it as a Flappy Bird themed animated SVG.
//
// Usage: node scripts/generate-flappy-svg.js <username> <output-file>
// Requires: GITHUB_TOKEN env var (the default Actions token works fine for public data)

const fs = require("fs");

const [, , USERNAME, OUTPUT = "dist/flappy-contribution-graph.svg"] = process.argv;

if (!USERNAME) {
  console.error("Usage: node generate-flappy-svg.js <username> <output-file>");
  process.exit(1);
}

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              date
              contributionCount
              color
            }
          }
        }
      }
    }
  }
`;

async function fetchContributions(login) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  const json = await res.json();
  if (!json.data || !json.data.user) {
    throw new Error("GraphQL error: " + JSON.stringify(json.errors || json));
  }
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

function levelFor(count) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function buildSvg(weeks) {
  const CELL = 11;
  const GAP = 3;
  const STEP = CELL + GAP;
  const GRID_TOP = 118;
  const GRID_LEFT = 40;
  const rows = 7;
  const cols = weeks.length;
  const width = GRID_LEFT * 2 + cols * STEP;
  const height = GRID_TOP + rows * STEP + 60;

  const cellFill = ["#dff4e8", "#b7e3c8", "#7fd1a1", "#3fae6e", "#1f7a44"];

  // background grid (the "contribution squares" become the sky's texture)
  let cellsSvg = "";
  const weekSums = weeks.map((w) =>
    w.contributionDays.reduce((s, d) => s + d.contributionCount, 0)
  );
  const maxWeekSum = Math.max(1, ...weekSums);

  weeks.forEach((week, wi) => {
    week.contributionDays.forEach((day, di) => {
      const level = levelFor(day.contributionCount);
      const x = GRID_LEFT + wi * STEP;
      const y = GRID_TOP + di * STEP;
      cellsSvg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${cellFill[level]}"/>`;
    });
  });

  // pipes: one per week, height driven by how active that week was.
  // busier week -> taller pipes -> smaller gap for the bird to fly through.
  let pipesSvg = "";
  const pipeEvery = 4; // don't draw a pipe every single week, just enough to read as a game
  for (let wi = 0; wi < cols; wi += pipeEvery) {
    const sum = weekSums[wi];
    const intensity = Math.min(1, sum / maxWeekSum);
    const gapCenter = GRID_TOP + (rows * STEP) / 2 + Math.sin(wi) * 30;
    const gapHeight = 55 - intensity * 28; // busier week = smaller gap = harder
    const x = GRID_LEFT + wi * STEP - 6;
    const pipeW = STEP + 4;
    const topH = gapCenter - gapHeight / 2 - GRID_TOP + 40;
    const botY = gapCenter + gapHeight / 2;
    const botH = GRID_TOP + rows * STEP + 40 - botY;
    pipesSvg += `
      <g>
        <rect x="${x}" y="${GRID_TOP - 40}" width="${pipeW}" height="${Math.max(
      10,
      topH
    )}" fill="#3fae6e" stroke="#1f7a44" stroke-width="2"/>
        <rect x="${x - 3}" y="${GRID_TOP - 40 + topH - 10}" width="${
      pipeW + 6
    }" height="12" fill="#3fae6e" stroke="#1f7a44" stroke-width="2"/>
        <rect x="${x}" y="${botY}" width="${pipeW}" height="${Math.max(
      10,
      botH
    )}" fill="#3fae6e" stroke="#1f7a44" stroke-width="2"/>
        <rect x="${x - 3}" y="${botY}" width="${
      pipeW + 6
    }" height="12" fill="#3fae6e" stroke="#1f7a44" stroke-width="2"/>
      </g>`;
  }

  // bird: flies a wave path across the whole scene, looping forever
  const birdPath = `M -20,${GRID_TOP + (rows * STEP) / 2} ${weeks
    .map((_, wi) => {
      const x = GRID_LEFT + wi * STEP;
      const y = GRID_TOP + (rows * STEP) / 2 + Math.sin(wi) * 30;
      return `L ${x},${y}`;
    })
    .join(" ")} L ${width + 20},${GRID_TOP + (rows * STEP) / 2}`;

  const duration = Math.max(8, Math.round(cols / 5));

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8ecbe8"/>
      <stop offset="100%" stop-color="#cdeaf7"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#sky)"/>
  <text x="${width / 2}" y="34" text-anchor="middle" font-family="Verdana, sans-serif" font-weight="bold" font-size="22" fill="#2c4a2e">${USERNAME}'s Contribution Flap</text>
  ${pipesSvg}
  ${cellsSvg}
  <rect x="0" y="${height - 20}" width="${width}" height="20" fill="#dcae5b"/>
  <rect x="0" y="${height - 24}" width="${width}" height="6" fill="#3fae6e"/>
  <g>
    <path id="birdpath" d="${birdPath}" fill="none" stroke="none"/>
    <g>
      <ellipse cx="0" cy="0" rx="9" ry="7" fill="#f6c545" stroke="#c98f1a" stroke-width="1.5"/>
      <polygon points="7,-2 15,0 7,2" fill="#e8722c"/>
      <circle cx="3" cy="-2" r="1.6" fill="#222"/>
      <animateMotion dur="${duration}s" repeatCount="indefinite" rotate="auto">
        <mpath href="#birdpath"/>
      </animateMotion>
    </g>
  </g>
</svg>`;
}

(async () => {
  const weeks = await fetchContributions(USERNAME);
  const svg = buildSvg(weeks);
  fs.mkdirSync(require("path").dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, svg);
  console.log(`Wrote ${OUTPUT}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
