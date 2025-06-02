# プロジェクトディレクトリ構造

```
.
├── public/
│   ├── index/
│   │   ├── v3.html
│   │   ├── v2.html
│   │   ├── v1.html
│   │   └── date.json
│   └── index.html
├── date/
│   └── date.json
├── server.js
├── package.json
└── README.md  ← このファイル
```

## 主要ファイルの説明

- `public/`: htmlファイルディレクトリ
  - `index/`: HTMLファイル
    - `v1.html`, `v2.html`, `v3.html`: バージョンファイル
    - `date.json`: 日付データ
- `date/date.json`: 日付データ
- `server.js`: メインのサーバーアプリケーション
- `package.json`: Node.jsプロジェクト設定ファイル
