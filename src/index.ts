#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';

interface ReleaseNoteInput {
  startTag: string;
  endTag: string;
  title?: string;
  features?: string[];
  improvements?: string[];
  bugfixes?: string[];
  breaking?: string[];
}

class IrisServer {
  private server: Server;
  private git: SimpleGit;

  constructor() {
    this.server = new Server(
      {
        name: 'iris-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.git = simpleGit({
      baseDir: process.cwd(),
      binary: 'git',
      maxConcurrentProcesses: 1,
    });
    
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_release_note',
          description: 'タグ間の差分からリリースノートを生成します',
          inputSchema: {
            type: 'object',
            properties: {
              startTag: {
                type: 'string',
                description: '開始タグ',
              },
              endTag: {
                type: 'string',
                description: '終了タグ',
              },
              title: {
                type: 'string',
                description: 'リリースノートのタイトル（オプション）',
              },
              features: {
                type: 'array',
                items: { type: 'string' },
                description: '新機能の一覧（オプション）',
              },
              improvements: {
                type: 'array',
                items: { type: 'string' },
                description: '改善項目の一覧（オプション）',
              },
              bugfixes: {
                type: 'array',
                items: { type: 'string' },
                description: 'バグ修正の一覧（オプション）',
              },
              breaking: {
                type: 'array',
                items: { type: 'string' },
                description: '破壊的変更の一覧（オプション）',
              },
            },
            required: ['startTag', 'endTag'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'generate_release_note') {
        const input = request.params.arguments as unknown as ReleaseNoteInput;
        if (!input.startTag || !input.endTag) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'startTagとendTagは必須パラメータです'
          );
        }
        return await this.handleGenerateReleaseNote(input);
      }
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    });
  }

  private async handleGenerateReleaseNote(input: ReleaseNoteInput) {
    try {
      // .irisディレクトリの作成
      const irisDir = path.join(process.cwd(), '.iris');
      await fs.ensureDir(irisDir);

      // タグ間の差分を取得
      const diff = await this.git.diff([input.startTag, input.endTag]);
      const files = diff.split('diff --git').slice(1);

      // リリースノートの内容を生成
      const content = this.generateReleaseNoteContent(input, files);

      // ファイル名を生成（タグ名とタイムスタンプを使用）
      const filename = `release-note-${input.endTag}-${Date.now()}.md`;
      const filePath = path.join(irisDir, filename);

      // リリースノートを保存
      await fs.writeFile(filePath, content, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: `リリースノートを生成しました: ${filePath}\n\n${content}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      throw new McpError(
        ErrorCode.InternalError,
        `リリースノートの生成に失敗しました: ${errorMessage}`
      );
    }
  }

  private generateReleaseNoteContent(input: ReleaseNoteInput, files: string[]): string {
    let content = '';
    const title = input.title || `Release ${input.endTag}`;
    const date = new Date().toISOString().split('T')[0];

    content += `# ${title}\n\n`;
    content += `リリース日: ${date}\n\n`;

    // 破壊的変更
    if (input.breaking && input.breaking.length > 0) {
      content += '## 💥 破壊的変更\n\n';
      input.breaking.forEach(item => {
        content += `- ${item}\n`;
      });
      content += '\n';
    }

    // 新機能
    if (input.features && input.features.length > 0) {
      content += '## ✨ 新機能\n\n';
      input.features.forEach(feature => {
        content += `- ${feature}\n`;
      });
      content += '\n';
    }

    // 改善項目
    if (input.improvements && input.improvements.length > 0) {
      content += '## 🔧 改善項目\n\n';
      input.improvements.forEach(improvement => {
        content += `- ${improvement}\n`;
      });
      content += '\n';
    }

    // バグ修正
    if (input.bugfixes && input.bugfixes.length > 0) {
      content += '## 🐛 バグ修正\n\n';
      input.bugfixes.forEach(bugfix => {
        content += `- ${bugfix}\n`;
      });
      content += '\n';
    }

    // 変更されたファイル
    if (files.length > 0) {
      content += '## 📝 変更されたファイル\n\n';
      files.forEach(file => {
        const match = file.match(/a\/(.*) b\//);
        if (match) {
          content += `- \`${match[1]}\`\n`;
        }
      });
      content += '\n';
    }

    return content;
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Iris MCP server running on stdio');
  }
}

const server = new IrisServer();
server.run().catch(console.error);
