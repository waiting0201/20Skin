/*
====================================================================================================
 20Skin — 後台預約管理效能索引（reused DB 政策例外，需 DB 擁有者放行）
 日期：2026-07-22
 授權：DB 擁有者已同意此次索引例外（見 docs/gotchas.md「reused DB 禁加索引」條之更新、docs/design/database-design.md §核心原則例外）
----------------------------------------------------------------------------------------------------
 背景：
   Appointments（約 12.4 萬列）、Members（約 5.4 萬列）原本只有 GUID 主鍵叢集索引，所有篩選欄皆無索引，
   後台預約列表（AppointmentAdminService.ListAsync）每次載入對 Appointments 做約 4 次全表掃描
   （單次全表 ≈ 3161 logical reads → 每次列表 ≈ 12,644 reads）。

 效益（本機 dev DB 實測，SET STATISTICS IO ON）：
   COUNT          3161 → 3     reads   （需搭配 OPTION(RECOMPILE)，見下方注意事項）
   分頁主查詢     3161 → 302   reads   （需搭配 OPTION(RECOMPILE)）
   初診 group-by  3161 → 153   reads
   容量表 apptCounts 3161 → 302 reads
   合計每次列表   ≈12,644 → ≈1,200 reads（約 10 倍改善）

 ★ 重要：索引「單獨」上線不足以加速 COUNT 與分頁主查詢。
   這兩條含 `(@dateOnly IS NULL OR a.AppointmentDate = @dateOnly)` 萬用 predicate，
   優化器會為「日期給/不給」共用一個保守計畫而仍走全表掃描；必須同時上線程式端的
   OPTION(RECOMPILE)（AppointmentAdminService.ListAsync，同一 commit）才會 seek。
   請「程式 + 索引」一起部署，勿只上其中一邊。

 對舊系統的影響：
   加 nonclustered index 對舊系統透明、非破壞性——不改表結構/欄位，舊查詢行為不變，只多一點點
   INSERT/UPDATE Appointments/Members 時的索引維護成本（4 個窄索引，成本低）。

 部署注意（正式環境）：
   - 建索引會取得 Sch-M 鎖，建置期間短暫阻塞該表讀寫。12.4 萬列約數秒，請於離峰時段執行。
   - 若 SQL Server 版本為 Enterprise，可加 WITH (ONLINE = ON) 避免阻塞（下方已附，非 Enterprise 請移除該選項）。
   - 腳本具幂等性（先 DROP IF EXISTS），可重複執行。
====================================================================================================
*/

SET XACT_ABORT ON;
SET NOCOUNT ON;

-- 主力：所有列表查詢都 filter BranchID、常帶 AppointmentDate、且 ORDER BY AppointmentDate
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Appointments_BranchID_AppointmentDate' AND object_id = OBJECT_ID('dbo.Appointments'))
    DROP INDEX IX_Appointments_BranchID_AppointmentDate ON dbo.Appointments;
CREATE NONCLUSTERED INDEX IX_Appointments_BranchID_AppointmentDate
    ON dbo.Appointments (BranchID, AppointmentDate);
    -- Enterprise 版可改為： ON dbo.Appointments (BranchID, AppointmentDate) WITH (ONLINE = ON);

-- 初診數 group-by（WHERE MemberID IN (...) AND Status = 1）與 Members join
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Appointments_MemberID_Status' AND object_id = OBJECT_ID('dbo.Appointments'))
    DROP INDEX IX_Appointments_MemberID_Status ON dbo.Appointments;
CREATE NONCLUSTERED INDEX IX_Appointments_MemberID_Status
    ON dbo.Appointments (MemberID, Status);

-- 以會員編號搜尋
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Members_Number' AND object_id = OBJECT_ID('dbo.Members'))
    DROP INDEX IX_Members_Number ON dbo.Members;
CREATE NONCLUSTERED INDEX IX_Members_Number
    ON dbo.Members (Number);

-- 以會員手機搜尋
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Members_Mobile' AND object_id = OBJECT_ID('dbo.Members'))
    DROP INDEX IX_Members_Mobile ON dbo.Members;
CREATE NONCLUSTERED INDEX IX_Members_Mobile
    ON dbo.Members (Mobile);

/*
----------------------------------------------------------------------------------------------------
 選擇性（暫不建，先觀察）：
   容量表 GetPeriodAmountsAsync 的 OUTER APPLY 會查 Rosters(BranchID, RosterDate, Clinic)，
   但 Rosters 表小（baseline 僅 ~112 reads），暫不建索引；若日後容量表變慢再考慮：
   -- CREATE NONCLUSTERED INDEX IX_Rosters_BranchID_RosterDate ON dbo.Rosters (BranchID, RosterDate);
----------------------------------------------------------------------------------------------------
 回滾（rollback）：
   DROP INDEX IX_Appointments_BranchID_AppointmentDate ON dbo.Appointments;
   DROP INDEX IX_Appointments_MemberID_Status          ON dbo.Appointments;
   DROP INDEX IX_Members_Number                        ON dbo.Members;
   DROP INDEX IX_Members_Mobile                        ON dbo.Members;
   （程式端 OPTION(RECOMPILE) 移除與否獨立；即使索引回滾，RECOMPILE 只是多一次編譯、無正確性風險。）
----------------------------------------------------------------------------------------------------
 驗證：
   SET STATISTICS IO ON; 重跑 AppointmentAdminService.ListAsync 對應 SQL，
   確認 Table 'Appointments'. logical reads 由 ~3161 降為數百。
====================================================================================================
*/
