import { DataSource } from "typeorm";
import path from "path";

export default new DataSource({
  type: "better-sqlite3",
  database: path.join(process.cwd(), "data", "taller.db"),
  entities: [
    path.join(process.cwd(), "./electron/DataBase/Entities/*.entity.ts"),
  ],
  migrations: [path.join(process.cwd(), "./electron/DataBase/Migrations/*.ts")],
  synchronize: false,
  logging: ["query", "error", "migration"],
});
