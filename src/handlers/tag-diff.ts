import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { simpleGit } from 'simple-git';
import { TagDiffInput, GitContext } from '../types.js';
import { validateTags } from '../utils/git.js';

export async function handleGetTagDiff(
  context: GitContext,
  input: TagDiffInput
): Promise<void> {
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
    // タグ間の差分を取得
    const diff = await gitContext.git.diff([input.startTag, input.endTag]);
    
    // 出力パスの生成
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = input.outputPath || `.iris/diff-${input.endTag}-${timestamp}.md`;
    
    // ディレクトリの作成
    const fs = require('fs');
    const path = require('path');
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
