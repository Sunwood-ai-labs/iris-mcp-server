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

  try {
    // タグの検証
    await validateTags(gitContext, input.startTag, input.endTag);

    try {
      console.log(`差分取得中...\n` +
        `開始タグ: ${input.startTag}\n` +
        `終了タグ: ${input.endTag}\n` +
        `作業ディレクトリ: ${workingDir}`);

      // 変更されたファイルの一覧を取得
      const { stdout: changedFiles, stderr: filesError } = await execAsync(
        `git diff --name-only ${input.startTag} ${input.endTag}`,
        { cwd: workingDir }
      );

      if (filesError) {
        console.error(`警告: git diff --name-onlyコマンドからのエラー出力:\n${filesError}`);
      }

      if (!changedFiles.trim()) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `指定されたタグ間に差分が存在しません:\n` +
          `開始タグ: ${input.startTag}\n` +
          `終了タグ: ${input.endTag}\n` +
          `作業ディレクトリ: ${workingDir}`
        );
      }

      // 出力パスの生成
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultFileName = `diff-${input.endTag}-${timestamp}.md`;
      const outputPath = input.outputPath
        ? path.join(workingDir, input.outputPath)
        : path.join(workingDir, defaultFileName);
      
      try {
        // 出力先ディレクトリの作成（必要な場合）
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // マークダウンコンテンツの作成
        let content = `# タグ間の差分: ${input.startTag} → ${input.endTag}\n\n`;
        content += `## 変更されたファイル\n\n`;

        const files = changedFiles.trim().split('\n');
        
        // 各ファイルの変更統計を取得
        for (const file of files) {
          const { stdout: stats } = await execAsync(
            `git diff --numstat ${input.startTag} ${input.endTag} -- "${file}"`,
            { cwd: workingDir }
          );
          const [additions, deletions] = stats.trim().split('\t');
          content += `### 📄 ${file}\n`;
          content += `- 追加行数: ${additions}\n`;
          content += `- 削除行数: ${deletions}\n\n`;

          // ファイルの差分を取得
          const { stdout: diff } = await execAsync(
            `git diff ${input.startTag} ${input.endTag} -- "${file}"`,
            { cwd: workingDir }
          );

          content += `<details><summary>差分の詳細</summary>\n\n`;
          content += `\`\`\`diff\n${diff}\n\`\`\`\n\n`;
          content += `</details>\n\n`;
        }

        // ファイルに書き出し
        fs.writeFileSync(outputPath, content);
        
        console.log(`差分情報を ${outputPath} に出力しました。`);
      } catch (fsError: unknown) {
        throw new McpError(
          ErrorCode.InternalError,
          `ファイル操作中にエラーが発生しました:\n` +
          `出力パス: ${outputPath}\n` +
          `エラー: ${fsError instanceof Error ? fsError.message : '不明なエラー'}`
        );
      }

    } catch (cmdError: unknown) {
      if (cmdError instanceof McpError) {
        throw cmdError;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Gitコマンド実行中にエラーが発生しました:\n` +
        `エラー: ${cmdError instanceof Error ? cmdError.message : '不明なエラー'}\n` +
        `作業ディレクトリ: ${workingDir}`
      );
    }

  } catch (error: unknown) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `差分取得中に予期せぬエラーが発生しました:\n` +
      `エラーメッセージ: ${error instanceof Error ? error.message : '不明なエラー'}\n` +
      `作業ディレクトリ: ${workingDir}`
    );
  }
}
