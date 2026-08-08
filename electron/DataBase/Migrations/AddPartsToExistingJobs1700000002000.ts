import { MigrationInterface, QueryRunner } from "typeorm";
import { logError } from "../../logger";

type CarRow = {
  id: string;
  jobs: string; // raw JSON string de la DB
};

type JobRow = {
  price: number;
  description: string;
  isThirdParty: boolean;
  status: string;
  parts?: { name: string; price: number }[];
};

type JobWithoutParts = Omit<JobRow, "parts">;

export class AddPartsToExistingJobs1700000002000 implements MigrationInterface {
  name = "AddPartsToExistingJobs1700000002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Traemos todos los autos que tienen jobs
    const cars: CarRow[] = await queryRunner.query(
      `SELECT id, jobs FROM car WHERE jobs IS NOT NULL`
    );

    for (const car of cars) {
      let jobs: JobRow[];
      try {
        jobs = JSON.parse(car.jobs);
      } catch (error) {
        logError("migration:AddPartsToExistingJobs:up", error, {
          reason: "jobs corruptos, se omite auto",
          carId: car.id,
        });
        continue;
      }

      // Agregamos parts: [] a los jobs que no lo tengan
      const updatedJobs = jobs.map((job) => ({
        ...job,
        parts: job.parts ?? [],
      }));

      await queryRunner.query(`UPDATE car SET jobs = ? WHERE id = ?`, [
        JSON.stringify(updatedJobs),
        car.id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cars = (await queryRunner.query(
      `SELECT id, jobs FROM car WHERE jobs IS NOT NULL`
    )) as CarRow[];

    for (const car of cars) {
      let jobs: JobRow[];
      try {
        jobs = JSON.parse(car.jobs);
      } catch (error) {
        logError("migration:AddPartsToExistingJobs:down", error, {
          reason: "jobs corruptos, se omite auto",
          carId: car.id,
        });
        continue;
      }
      const updatedJobs: JobWithoutParts[] = jobs.map(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ parts: _, ...rest }) => rest
      );

      await queryRunner.query(`UPDATE car SET jobs = ? WHERE id = ?`, [
        JSON.stringify(updatedJobs),
        car.id,
      ]);
    }
  }
}
