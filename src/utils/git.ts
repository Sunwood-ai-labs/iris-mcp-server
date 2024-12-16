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
    // git tagコマンドを直接実行
    const { stdout } = await execAsync('git tag', { cwd: context.workingDir });
    const existingTags = stdout.split('\n').filter(Boolean);

    if (!existingTags.includes(startTag)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `開始タグ '${startTag}' がリポジトリに存在しません（${context.workingDir}）。\n利用可能なタグ: ${existingTags.join(', ')}`
      );
    }

    if (!existingTags.includes(endTag)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `終了タグ '${endTag}' がリポジトリに存在しません（${context.workingDir}）。\n利用可能なタグ: ${existingTags.join(', ')}`
      );
    }

    // タグの存在確認
    await execAsync(`git rev-parse ${startTag}`, { cwd: context.workingDir });
    await execAsync(`git rev-parse ${endTag}`, { cwd: context.workingDir });

  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `タグの検証中にエラーが発生しました（${context.workingDir}）: ${error instanceof Error ? error.message : '不明なエラー'}`
    );
  }
}
