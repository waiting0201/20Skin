using Skin.Core.Dtos;

namespace Skin.Services.BasicData;

/// <summary>後台醫師主檔維護。Doctors 表無 Sort/IsEnabled 欄位，無排序、無軟刪。</summary>
public interface IDoctorAdminService
{
    Task<IReadOnlyList<DoctorAdminDto>> ListAsync(CancellationToken ct = default);
    Task<DoctorAdminDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Guid> CreateAsync(DoctorUpsertRequest req, CancellationToken ct = default);
    Task UpdateAsync(Guid id, DoctorUpsertRequest req, CancellationToken ct = default);

    /// <summary>刪除前檢查：Appointments/Rosters 有任一引用即擋。</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
