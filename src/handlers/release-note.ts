import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { simpleGit } from 'simple-git';
import { ReleaseNoteInput, GitContext } from '../types.js';
import { validateTags } from '../utils/git.js';

export async function handleGenerateReleaseNote(
  context: GitContext,
  input: ReleaseNoteInput
): Promise<string> {
  // 作業ディレクトリが指定された場合、新しいgitインスタンスを作成
  let gitContext = context;
  if (input.workingDir) {
    gitContext = {
      git: simpleGit({
        baseDir: input.workingDir,
        binary: 'git',
        maxConcurrentProcesses: 1,
      }),
      workingDir: input.workingDir,
    };
  }

  await validateTags(gitContext, input.startTag, input.endTag);

  try {
    // タグ間のコミットログを取得
    const logs = await gitContext.git.log({
      from: input.startTag,
      to: input.endTag,
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
    logs.all.forEach(commit => {
      content += `- ${commit.message} (${commit.hash.substring(0, 7)})\n`;
    });

    return content;
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `リリースノートの生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`
    );
  }
}
