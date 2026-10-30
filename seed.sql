-- ============================================================
-- 结构型种子数据：后台菜单 + 快捷入口
--
-- 新装用户不需要跑这个文件——站点配置（密钥/别名/站点名）由 /setup 向导生成，
-- 但后台侧边栏的菜单是数据驱动的（menus 表），空表会导致后台没有菜单。
-- 所以初始化顺序是：
--   1) wrangler d1 execute vmq --file=./schema.sql --remote
--   2) wrangler d1 execute vmq --file=./seed.sql   --remote
--   3) 部署后访问 /setup 创建管理员
-- ============================================================


-- menus：后台侧边栏菜单
DELETE FROM menus;
INSERT INTO menus (id, pid, title, icon, href, target, sort, status, remark, create_time, update_time) VALUES ('250', '0', '系统管理', 'fa fa-cog', '', '_self', '0', '1', '', '0', '0');
INSERT INTO menus (id, pid, title, icon, href, target, sort, status, remark, create_time, update_time) VALUES ('254', '250', '配置管理', 'fa fa-asterisk', 'system.config/edit', '_self', '6', '1', '', '0', '0');
INSERT INTO menus (id, pid, title, icon, href, target, sort, status, remark, create_time, update_time) VALUES ('260', '250', '快捷入口', 'fa fa-arrow-circle-right', 'system.quick/index', '_self', '7', '1', '', '0', '0');
INSERT INTO menus (id, pid, title, icon, href, target, sort, status, remark, create_time, update_time) VALUES ('264', '250', '通道管理', 'fa fa-archive', 'system.passage/index', '_self', '1', '1', '', '1678279537', '1678279537');
INSERT INTO menus (id, pid, title, icon, href, target, sort, status, remark, create_time, update_time) VALUES ('266', '250', '支付配置', 'fa fa-gratipay', 'system.pay/edit', '_self', '3', '1', '', '1678279853', '1678279853');
INSERT INTO menus (id, pid, title, icon, href, target, sort, status, remark, create_time, update_time) VALUES ('268', '250', '订单管理', 'fa fa-first-order', 'system.order/index', '_self', '2', '1', '', '1686037775', '1686037775');
