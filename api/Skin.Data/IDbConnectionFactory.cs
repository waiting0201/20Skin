using System.Data;
using Microsoft.Data.SqlClient;

namespace Skin.Data;

/// <summary>
/// 建立連到 reused DB（SQL Server `20Skin`）的連線，供 Dapper 使用。
/// schema 不可改、無 migration、無 DbContext。連線字串來自設定（正式經 Key Vault）。
/// 見 docs/design/database-design.md、backend-design.md。
/// </summary>
public interface IDbConnectionFactory
{
    IDbConnection Create();
}

public sealed class SqlConnectionFactory(string connectionString) : IDbConnectionFactory
{
    public IDbConnection Create() => new SqlConnection(connectionString);
}
