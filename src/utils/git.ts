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
    // git tagコマンドを直接実行してタグ一覧を取得
    const { stdout: tagOutput } = await execAsync('git tag', { cwd: context.workingDir });
    const existingTags = tagOutput.split('\n').filter(Boolean);

    if (!existingTags.includes(startTag)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `開始タグ '${startTag}' がリポジトリに存在しません\n` +
        `作業ディレクトリ: ${context.workingDir}\n` +
        `利用可能なタグ: ${existingTags.join(', ')}`
      );
    }

    if (!existingTags.includes(endTag)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `終了タグ '${endTag}' がリポジトリに存在しません\n` +
        `作業ディレクトリ: ${context.workingDir}\n` +
        `利用可能なタグ: ${existingTags.join(', ')}`
      );
    }

    try {
      // タグのコミットハッシュを取得
      const { stdout: startHash } = await execAsync(`git rev-parse ${startTag}`, { cwd: context.workingDir });
      const { stdout: endHash } = await execAsync(`git rev-parse ${endTag}`, { cwd: context.workingDir });

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

    } catch (cmdError) {
      throw new McpError(
        ErrorCode.InternalError,
        `タグの検証中にGitコマンドエラーが発生しました:\n` +
        `コマンド: ${(cmdError as any).cmd}\n` +
        `エラー: ${(cmdError as Error).message}\n` +
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
