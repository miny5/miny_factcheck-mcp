#!/usr/bin/env node

/**
 * miny_factcheck-mcp 자동 설치 스크립트 (Antigravity 전용)
 * 
 * 사용법: node setup.js
 * 
 * 이 스크립트는 자동으로:
 * 1. npm install & npm run build 실행
 * 2. Antigravity MCP 설정 파일(mcp_config.json)에 서버 등록
 * 3. API 키 설정 안내
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── 색상 헬퍼 ──
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

function log(msg) { console.log(msg); }
function success(msg) { log(`${C.green}✅ ${msg}${C.reset}`); }
function warn(msg) { log(`${C.yellow}⚠️  ${msg}${C.reset}`); }
function info(msg) { log(`${C.cyan}ℹ️  ${msg}${C.reset}`); }
function header(msg) {
  log(`\n${C.bold}${C.cyan}${"═".repeat(50)}${C.reset}`);
  log(`${C.bold}  ${msg}${C.reset}`);
  log(`${C.cyan}${"═".repeat(50)}${C.reset}\n`);
}

// ── readline 프롬프트 ──
function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${C.yellow}? ${question}${C.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Antigravity MCP 설정 파일 경로 ──
function getMcpConfigPath() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  return join(home, ".gemini", "antigravity", "mcp_config.json");
}

// ── 메인 ──
async function main() {
  header("📋 Miny Factcheck MCP — Antigravity 자동 설치");

  // ── Step 1: npm install ──
  log(`${C.bold}[1/3] 패키지 설치 중...${C.reset}`);
  try {
    execSync("npm install", { cwd: __dirname, stdio: "inherit" });
    success("패키지 설치 완료!");
  } catch (e) {
    log(`${C.red}❌ npm install 실패. Node.js가 설치되어 있는지 확인하세요.${C.reset}`);
    log(`${C.dim}   다운로드: https://nodejs.org${C.reset}`);
    process.exit(1);
  }

  // ── Step 2: 빌드 ──
  log(`\n${C.bold}[2/3] TypeScript 빌드 중...${C.reset}`);
  try {
    execSync("npm run build", { cwd: __dirname, stdio: "inherit" });
    success("빌드 완료!");
  } catch (e) {
    log(`${C.red}❌ 빌드 실패.${C.reset}`);
    process.exit(1);
  }

  // ── Step 3: Antigravity mcp_config.json 등록 ──
  log(`\n${C.bold}[3/3] Antigravity에 MCP 서버 등록 중...${C.reset}`);

  const configPath = getMcpConfigPath();
  const configDir = dirname(configPath);

  info(`설정 파일: ${configPath}`);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
    info("설정 폴더 생성됨");
  }

  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
      info("기존 mcp_config.json 발견 — 병합합니다.");
    } catch {
      warn("기존 mcp_config.json 파싱 실패 — 새로 생성합니다.");
    }
  }

  if (!config.mcpServers) config.mcpServers = {};

  if (config.mcpServers["miny_factcheck-mcp"]) {
    const overwrite = await ask("miny_factcheck-mcp가 이미 등록되어 있습니다. 덮어쓸까요? (y/n)");
    if (overwrite.toLowerCase() !== "y") {
      info("기존 설정을 유지합니다.");
      finish(configPath);
      return;
    }
  }

  // ── API 키 입력 (선택) ──
  header("🔑 API 키 설정 (선택사항)");
  log(`${C.dim}API 키가 없어도 기본 기능은 동작합니다.${C.reset}`);
  log(`${C.dim}나중에 mcp_config.json에서 직접 추가할 수도 있습니다.${C.reset}`);
  log(`${C.dim}Enter를 누르면 건너뜁니다.\n${C.reset}`);

  const naverClientId = await ask("네이버 Client ID (developers.naver.com):");
  const naverClientSecret = naverClientId ? await ask("네이버 Client Secret:") : "";
  const googleApiKey = await ask("Google API Key (console.cloud.google.com):");
  const googleCseId = googleApiKey ? await ask("Google CSE ID:") : "";
  const kosisApiKey = await ask("KOSIS API Key (kosis.kr/openapi):");
  const bokApiKey = await ask("한국은행 ECOS API Key (ecos.bok.or.kr):");

  // ── 설정 생성 ──
  const distPath = join(__dirname, "dist", "index.js");

  const env = {};
  if (naverClientId) env.NAVER_CLIENT_ID = naverClientId;
  if (naverClientSecret) env.NAVER_CLIENT_SECRET = naverClientSecret;
  if (googleApiKey) env.GOOGLE_API_KEY = googleApiKey;
  if (googleCseId) env.GOOGLE_CSE_ID = googleCseId;
  if (kosisApiKey) env.KOSIS_API_KEY = kosisApiKey;
  if (bokApiKey) env.BOK_API_KEY = bokApiKey;

  config.mcpServers["miny_factcheck-mcp"] = {
    command: "node",
    args: [distPath],
    env,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  success("설정 저장 완료!");

  finish(configPath);
}

function finish(configPath) {
  header("🎉 설치 완료!");
  log(`  Antigravity를 재시작하면 팩트체크 기능을 사용할 수 있습니다.`);
  log("");
  log(`  ${C.bold}사용 예시:${C.reset}`);
  log(`  ${C.cyan}> "테슬라가 시가총액 1위라는 주장을 팩트체크해줘"${C.reset}`);
  log(`  ${C.cyan}> "이 기사의 숫자가 맞는지 확인해줘"${C.reset}`);
  log("");
  log(`  ${C.dim}API 키는 나중에 아래 파일에서 수정 가능합니다:${C.reset}`);
  log(`  ${C.dim}${configPath}${C.reset}`);
  log("");
  log(`  ${C.yellow}⚠️  중요: Antigravity를 재시작해야 적용됩니다!${C.reset}`);
  log("");
}

main().catch((err) => {
  console.error(`${C.red}설치 중 오류 발생: ${err.message}${C.reset}`);
  process.exit(1);
});
