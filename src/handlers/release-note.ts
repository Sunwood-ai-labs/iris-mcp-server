import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ReleaseNoteInput, GitContext } from '../types.js';
import { validateTags } from '../utils/git.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function handleGenerateReleaseNote(
  context: GitContext,
  input: ReleaseNoteInput
): Promise<string> {
  const workingDir = input.workingDir || context.workingDir;
  const gitContext = { ...context, workingDir };

  await validateTags(gitContext, input.startTag, input.endTag);

  try {
    // タグ間のコミットログを取得
    const { stdout: logOutput } = await execAsync(
      `git log --pretty=format:"%h|%s" ${input.startTag}..${input.endTag}`,
      { cwd: workingDir }
    );

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

    return content;
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `リリースノートの生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`
    );
  }
}
