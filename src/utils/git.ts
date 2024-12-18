import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { GitContext } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function validateTags(
  context: GitContext,
  startTag: string,
  endTag: string
): Promise<void> {
  try {
    try {
      // タグのコミットハッシュを取得して存在確認
      const { stdout: startHash, stderr: startErr } = await execAsync(
        `git rev-parse --verify ${startTag}^{commit}`,
        { cwd: context.workingDir }
      );

      if (!startHash.trim()) {
        throw new Error(`開始タグ '${startTag}' が見つかりません`);
      }

      const { stdout: endHash, stderr: endErr } = await execAsync(
        `git rev-parse --verify ${endTag}^{commit}`,
        { cwd: context.workingDir }
      );

      if (!endHash.trim()) {
        throw new Error(`終了タグ '${endTag}' が見つかりません`);
      }

      // タグ間のコミット数を確認
      const { stdout: commitCount } = await execAsync(
        `git rev-list --count ${startTag}..${endTag}`,
        { cwd: context.workingDir }
      );

      console.log(`デバッグ情報:\n` +
        `開始タグ ${startTag}: ${startHash.trim()}\n` +
        `終了タグ ${endTag}: ${endHash.trim()}\n` +
        `コミット数: ${commitCount.trim()}`
      );

      if (startErr) console.error(`警告 (開始タグ): ${startErr}`);
      if (endErr) console.error(`警告 (終了タグ): ${endErr}`);

    } catch (cmdError: unknown) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `タグの検証中にエラーが発生しました:\n` +
        `エラー: ${cmdError instanceof Error ? cmdError.message : '不明なエラー'}\n` +
        `作業ディレクトリ: ${context.workingDir}`
      );
    }

  } catch (error: unknown) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `タグの検証中に予期せぬエラーが発生しました:\n` +
      `エラーメッセージ: ${error instanceof Error ? error.message : '不明なエラー'}\n` +
      `作業ディレクトリ: ${context.workingDir}`
    );
  }
}
