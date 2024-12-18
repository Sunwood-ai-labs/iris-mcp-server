import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ReleaseNoteInput, GitContext } from '../types.js';
import { validateTags } from '../utils/git.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export async function handleGenerateReleaseNote(
  context: GitContext,
  input: ReleaseNoteInput
): Promise<void> {
  const workingDir = input.workingDir || context.workingDir;
  const gitContext = { ...context, workingDir };

  try {
    // タグの検証
    await validateTags(gitContext, input.startTag, input.endTag);

    try {
      // タグ間のコミットログを取得
      console.log(`コミットログ取得中...\n` +
        `開始タグ: ${input.startTag}\n` +
        `終了タグ: ${input.endTag}\n` +
        `作業ディレクトリ: ${workingDir}`);

      const { stdout: logOutput, stderr: logError } = await execAsync(
        `git log --pretty=format:"%h|%s" ${input.startTag}..${input.endTag}`,
        { cwd: workingDir }
      );

      if (logError) {
        console.error(`警告: git logコマンドからのエラー出力:\n${logError}`);
      }

      if (!logOutput.trim()) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `指定されたタグ間にコミットが存在しません:\n` +
          `開始タグ: ${input.startTag}\n` +
          `終了タグ: ${input.endTag}\n` +
          `作業ディレクトリ: ${workingDir}`
        );
      }

      const commits = logOutput.split('\n').map(line => {
        const [hash, ...messageParts] = line.split('|');
        return {
          hash,
          message: messageParts.join('|')
        };
      });

      // リリースノートの生成
      const title = input.title || `リリースノート: ${input.startTag} → ${input.endTag}`;
      let content = `# ${title}\n\n`;

      // 破壊的変更
      if (input.breaking && input.breaking.length > 0) {
        content += '## ⚠️ 破壊的変更\n\n';
        input.breaking.forEach(item => {
          content += `- ${item}\n`;
        });
        content += '\n';
      }

      // 新機能
      if (input.features && input.features.length > 0) {
        content += '## ✨ 新機能\n\n';
        input.features.forEach(item => {
          content += `- ${item}\n`;
        });
        content += '\n';
      }

      // 改善項目
      if (input.improvements && input.improvements.length > 0) {
        content += '## 🔧 改善項目\n\n';
        input.improvements.forEach(item => {
          content += `- ${item}\n`;
        });
        content += '\n';
      }

      // バグ修正
      if (input.bugfixes && input.bugfixes.length > 0) {
        content += '## 🐛 バグ修正\n\n';
        input.bugfixes.forEach(item => {
          content += `- ${item}\n`;
        });
        content += '\n';
      }

      // コミットログ
      content += '## 📝 コミットログ\n\n';
      commits.forEach(({ hash, message }) => {
        content += `- ${message} (${hash})\n`;
      });

      // 出力パスの生成
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultFileName = `release-note-${input.endTag}-${timestamp}.md`;
      const outputDir = path.join(workingDir, 'release_note');
      const outputPath = path.join(outputDir, defaultFileName);

      try {
        // 出力先ディレクトリの作成
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // ファイルに書き出し
        fs.writeFileSync(outputPath, content);
        
        console.log(`リリースノートを ${outputPath} に出力しました。`);
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
      `リリースノート生成中に予期せぬエラーが発生しました:\n` +
      `エラーメッセージ: ${error instanceof Error ? error.message : '不明なエラー'}\n` +
      `作業ディレクトリ: ${workingDir}`
    );
  }
}
