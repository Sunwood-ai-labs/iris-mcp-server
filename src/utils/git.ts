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
      // タグの存在を確認
      const { stdout: tags } = await execAsync(
        'git tag -l',
        { cwd: context.workingDir }
      );

      const existingTags = tags.trim().split('\n');
      
      if (!existingTags.includes(startTag)) {
        throw new Error(`開始タグ '${startTag}' が見つかりません`);
      }

      if (!existingTags.includes(endTag)) {
        throw new Error(`終了タグ '${endTag}' が見つかりません`);
      }

      // タグ間のコミット履歴を確認
      const { stdout: commits, stderr: logErr } = await execAsync(
        `git log --oneline ${startTag}..${endTag}`,
        { cwd: context.workingDir }
      );

      if (!commits.trim()) {
        throw new Error(`タグ間 '${startTag}..${endTag}' にコミットが存在しません`);
      }

      const commitCount = commits.trim().split('\n').length;

      console.log(`デバッグ情報:\n` +
        `開始タグ: ${startTag}\n` +
        `終了タグ: ${endTag}\n` +
        `コミット数: ${commitCount}`
      );

      if (logErr) console.error(`警告: ${logErr}`);

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
