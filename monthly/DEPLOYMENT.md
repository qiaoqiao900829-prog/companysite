# 瑞鳳堂 MONTHLY 开发交付说明（尚未上线）

## 已提交
- `monthly-admin.html`：管理员登录后选择现有短租房源，配置独立价格、押金、水电煤、旺季和封锁日期，查看预约申请。
- `monthly-quote.js`：在现有 `property.html` 房源详情页展示月租试算、邮件咨询与预约申请表。仅在短租房源且 monthly_settings.enabled=true 时显示。
- `monthly/schema.sql`：独立月租配置、封锁日期、申请表及权限策略；没有针对原有房源或照片的更新、删除语句。
- `supabase/functions/monthly-request/index.ts`：预约申请服务端价格复核、日期检查、Turnstile 验证、写入待审核申请和邮件通知尝试。
- `monthly/index.html` 与 `monthly/admin-demo.html` 为早期演示，不是正式使用入口。

## 尚需实际部署 / 验证
1. 先备份 Supabase，再由有权限的人在 SQL Editor 审核、运行 `monthly/schema.sql`。它**尚未执行**。
2. 以原有管理员的 auth.users UUID 注册 `monthly_admins`，不能使用公开邮箱直接授予权限。
3. 配置 Cloudflare Turnstile 站点密钥和服务端密钥，并在网站配置 `window.ZUIHOUDOU_TURNSTILE_SITE_KEY`。
4. 部署 Supabase Edge Function `monthly-request`，配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`TURNSTILE_SECRET_KEY`、`RESEND_API_KEY`、`NOTIFY_EMAIL`。邮件发送域名需要验证，示例发件人必须换成验证过的域名地址。
5. 网站配置 `window.ZUIHOUDOU_MONTHLY_REQUEST_ENDPOINT` 指向 Edge Function。此项缺失时申请按钮不能正常提交。
6. 核对生产环境 CORS / RLS / 图片访问、移动端显示，测试管理员编辑费用→客户刷新看到新费用→提交申请→后台收到申请→邮件通知，以及整栋/单间库存互斥规则。
7. 目前**未实现**整栋与单间互斥防重复预约、原有照片的独立上传后台、邮件送达保证，也未进行端到端测试。不要合并到 main 或投入正式营业。

## 计算约定（需要业务确认）
- 租金 = 月租 × 入住晚数 ÷ 30；不足最低晚数不报价。
- 水电煤 = 入住晚数 ×（首人每日费 + 额外人数 × 每增一人每日费）。
- 旺季按日期区间逐日加价，结束日期不包含在内。
- 押金与合同手续费计入预计初期支付；管理费固定为零。
- 此规则不适用于按自然月整月收费的特殊合同，需后续单独支持。

## 重要安全边界
正式数据库和网站尚未更改；此开发分支不应在上述部署、权限审核及完整测试前合并。
