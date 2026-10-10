declare module "modbus-serial" {
  export default class ModbusRTU {
    constructor(port?: unknown);
    setTimeout(ms: number): void;
    setID(id: number): void;
    connectTCP(host: string, options: { port: number }): Promise<void>;
    readInputRegisters(
      dataAddress: number,
      length: number,
    ): Promise<{ data: number[]; buffer: Buffer }>;
    close(callback?: () => void): void;
  }
}
