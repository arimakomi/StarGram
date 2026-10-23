# ⭐ StarGram

> **语言：** [English](../../README.md) · [فارسی](README.fa.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [Türkçe](README.tr.md) · [简体中文](README.zh-CN.md)

StarGram 是一款可自行托管的网页即时通讯应用，界面为波斯语，支持私聊、群组、频道、动态和管理功能。数据保存在自己的服务器上，可使用 PostgreSQL、MySQL/MariaDB 或本地 JSON 文件。

## 功能

- 私聊、群聊、频道、搜索、回复、编辑、表情反馈和置顶消息
- 图片、语音消息、动态和浏览器通知
- 用户、举报、群组、频道及系统设置管理
- 主题、聊天背景和本地生成的 SVG 默认头像
- 可选 Gemini 助手
- Linux 安装程序、systemd 服务和英文 stargram 管理菜单

## 安装

需要 Node.js 18 或更高版本及 npm。Linux 安装程序需要 root 或 sudo。SQL 可选；DB_TYPE=local 使用 JSON。公开部署请通过 Nginx 或 Caddy 配置 HTTPS。

~~~bash
bash <(curl -fsSL https://raw.githubusercontent.com/arimakomi/StarGram/main/setup.sh)
~~~

手动安装：

~~~bash
git clone https://github.com/arimakomi/StarGram.git
cd StarGram
npm ci
cp .env.example .env
~~~

在 .env 中配置 PORT、DB_TYPE、ADMIN_USER 和 ADMIN_PASS，然后运行：

~~~bash
npm run build
node server.js --init
npm start
~~~

PostgreSQL 或 MySQL/MariaDB 需要配置 DB_TYPE、DB_HOST、DB_PORT、DB_NAME、DB_USER 和 DB_PASS。也支持 DATABASE_URL。

## 管理与安全

~~~bash
sudo stargram
sudo stargram status
sudo stargram start
sudo stargram stop
sudo stargram restart
sudo stargram logs
sudo stargram health
sudo stargram backup
sudo stargram admin
sudo stargram update
sudo stargram help
~~~

update 会直接从 GitHub 下载 main 分支归档，因此安装目录即使不是 Git 仓库也能更新。它会替换应用文件、安装依赖、构建前端，并在可用时重启 systemd。data/、backups/、.env 文件和 node_modules/ 会保留；本地代码修改可能被覆盖。PWA 安装需要兼容浏览器和 HTTPS。项目采用 MIT 许可证。
