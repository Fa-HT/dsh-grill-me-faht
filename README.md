# dsh-grill-me-faht (DSH 技能插件)

把“拷问方案”这件事做成一条可开关的 DSH 技能：一次只问一个问题，把方案或设计里的每个决策分支都问到有明确结论，最后给出决策汇总；会话在 plan mode 时则把结论作为计划提交审批。

## 安装与开关

在 DSH 里安装这个目录，用「插件」里的「添加插件」输入文件夹路径。安装后会在「插件」里出现 **dsh-grill-me-faht** 一行：

- 打开：技能目录里出现 `grill-me`，可用 `/grill-me` 手动触发，模型也可按 description 自动加载。
- 关闭：技能与 `/grill-me` 命令立即从目录中消失；重新打开即恢复。开关状态在重启后保留。

## 技能文件

技能正文是包内的 `skills/grill-me/SKILL.md`，它是唯一真源。插件通过文件监听读取该文件：改正文后下一次加载即生效，不需要重装插件；改完若目录未刷新，关开一次插件即可。

## 包内结构

- `lib/index.js`：注册 `grill-me` 技能 provider（读取并监听 SKILL.md）。
- `skills/grill-me/SKILL.md`：技能正文与 frontmatter。
- `cordis.patch.yml`：bundle 的 loader 补丁。
- `locale/*.json`、`icon.svg`、`docs/*`：插件列表与详情页的展示资源。

- ## 注意

- 这个是使用AI对 grill-me-skill 的改编

## License

MIT
