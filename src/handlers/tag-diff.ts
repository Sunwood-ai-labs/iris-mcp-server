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

      // タグ間の差分を取得
      const { stdout: diff, stderr: diffError } = await execAsync(
        `git diff ${input.startTag} ${input.endTag}`,
        { cwd: workingDir }
      );

      if (diffError) {
        console.error(`警告: git diffコマンドからのエラー出力:\n${diffError}`);
      }

      if (!diff.trim()) {
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
      const outputPath = input.outputPath || `.iris/diff-${input.endTag}-${timestamp}.md`;
      
      try {
        // ディレクトリの作成
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        // 差分情報をマークダウンファイルに出力
        const content = `# タグ間の差分: ${input.startTag} → ${input.endTag}\n\n\`\`\`diff\n${diff}\n\`\`\``;
        fs.writeFileSync(outputPath, content);
        
        console.log(`差分情報を ${outputPath} に出力しました。`);
      } catch (fsError) {
        throw new McpError(
          ErrorCode.InternalError,
          `ファイル操作中にエラーが発生しました:\n` +
          `出力パス: ${outputPath}\n` +
          `エラー: ${fsError instanceof Error ? fsError.message : '不明なエラー'}`
        );
      }

    } catch (cmdError) {
      if (cmdError instanceof McpError) {
        throw cmdError;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Gitコマンド実行中にエラーが発生しました:\n` +
        `コマンド: ${(cmdError as any).cmd}\n` +
        `エラー: ${(cmdError as Error).message}\n` +
        `作業ディレクトリ: ${workingDir}`
      );
    }

  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `差分取得中に予期せぬエラーが発生しました:\n` +
      `エラータイプ: ${error.constructor.name}\n` +
      `エラーメッセージ: ${error instanceof Error ? error.message : '不明なエラー'}\n` +
      `作業ディレクトリ: ${workingDir}`
    );
  }
}
