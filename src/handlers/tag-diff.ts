import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { TagDiffInput, GitContext } from '../types.js';
import { validateTags } from '../utils/git.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export async function handleGetTagDiff(
  context: GitContext,
  input: TagDiffInput
): Promise<void> {
  const workingDir = input.workingDir || context.workingDir;
  const gitContext = { ...context, workingDir };

  await validateTags(gitContext, input.startTag, input.endTag);

  try {
    // タグ間の差分を取得
    const { stdout: diff } = await execAsync(
      `git diff ${input.startTag} ${input.endTag}`,
      { cwd: workingDir }
    );
    
    // 出力パスの生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = input.outputPath || `.iris/diff-${input.endTag}-${timestamp}.md`;
    
    // ディレクトリの作成
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 差分情報をマークダウンファイルに出力
    const content = `# タグ間の差分: ${input.startTag} → ${input.endTag}\n\n\`\`\`diff\n${diff}\n\`\`\``;
    fs.writeFileSync(outputPath, content);
    
    console.log(`差分情報を ${outputPath} に出力しました。`);
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `差分の取得中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`
    );
  }
}
