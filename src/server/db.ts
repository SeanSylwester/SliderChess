import { Pool, Client, PoolClient, QueryArrayResult, QueryResult } from 'pg';
import { Game } from './gameLogic.js'


const pool = new Pool({ ssl: { rejectUnauthorized: false } });
const table = process.env.LOCAL ? 'games_dummy' : 'games';

export async function query(text: string, params: any): Promise<QueryArrayResult> {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('executed query', { text, duration, rows: res.rowCount })
  return res
}
 
export async function getClient(): Promise<PoolClient> {
  return pool.connect()
}

export async function testConnection(): Promise<void> {
    try {
        const res = await query('SELECT NOW();', []);
        console.log(1, res)
    } catch (err) {
        console.error(err);
    }
}
    

const cols = ['password', 'white', 'black', 'chat_log', 'moves_log', 'whites_turn', 'initial_time_white', 'initial_time_black', 'increment_white', 'increment_black', 'time_left_white', 'time_left_black', 'rules', 'result', 'cause', 'is_active'];
export async function saveToDB(game: Game): Promise<QueryArrayResult | undefined> {
    const colEqVal = game.getDBStr();
    try {
        const res = await query(`UPDATE ${table} SET ${colEqVal} WHERE id = ${game.id};`, []);
        return res;
    } catch (err) {
        console.log(err);
    }
}

export async function gameFromDB(gameId: number): Promise<QueryResult | undefined> {
    try {
        const res = await query(`SELECT * FROM ${table} WHERE id = ${gameId};`, []);
        return res;
    } catch (err) {
        console.log(err);
    }
}

export async function gamesFromDB(): Promise<QueryArrayResult | undefined> {
    try {
        const res = await query(`SELECT * FROM ${table};`, []);
        return res;
    } catch (err) {
        console.log(err);
    }
}

export async function storeNewGame(): Promise<number | undefined> {
    try {
        const res: any = await query(`INSERT INTO ${table} DEFAULT VALUES RETURNING id;`, []);
        return res.rows[0].id;
    } catch (err) {
        console.log(err);
    }
}

export async function createDummyTable(): Promise<void> {
    await pool.query('DROP TABLE IF EXISTS games_dummy;', []);
    await pool.query('CREATE TABLE games_dummy AS SELECT * FROM games;', []);
}