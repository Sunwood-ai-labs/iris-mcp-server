import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { IrisServerOptions, TagDiffInput, ReleaseNoteInput, GitContext } from './types.js';
import { handleGetTagDiff } from './handlers/tag-diff.js';
import { handleGenerateReleaseNote } from './handlers/release-note.js';

export class IrisServer {
  private server: Server;
  private gitContext: GitContext;

  constructor(options?: IrisServerOptions) {
    const workingDir = options?.workingDir || process.cwd();
    
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

    this.gitContext = {
      workingDir,
    };
    
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_tag_diff',
          description: 'タグ間の差分情報をマークダウンファイルで出力します',
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
              outputPath: {
                type: 'string',
                description: '出力先のパス（オプション、デフォルトは.iris/diff-{endTag}-{timestamp}.md）',
              },
              workingDir: {
                type: 'string',
                description: 'Gitリポジトリの作業ディレクトリ（オプション）',
              },
            },
            required: ['startTag', 'endTag'],
          },
        },
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
              workingDir: {
                type: 'string',
                description: 'Gitリポジトリの作業ディレクトリ（オプション）',
              },
            },
            required: ['startTag', 'endTag'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_tag_diff':
          await handleGetTagDiff(this.gitContext, request.params.arguments as unknown as TagDiffInput);
          return {
            content: [
              {
                type: 'text',
                text: '差分情報を出力しました。',
              },
            ],
          };

        case 'generate_release_note':
          const content = await handleGenerateReleaseNote(
            this.gitContext,
            request.params.arguments as unknown as ReleaseNoteInput
          );
          return {
            content: [
              {
                type: 'text',
                text: content,
              },
            ],
          };

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Iris MCP server running on stdio');
  }
}
