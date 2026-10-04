import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const execute=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/db",()=>({getDb:()=>({execute})}));
import { withGuelphSession } from "./guelph-session";
beforeEach(()=>{execute.mockReset();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-03T00:00:00Z'));});
afterEach(()=>vi.useRealTimers());
describe('Guelph distributed source lease',()=>{
  it('fails closed before the callback when another worker owns the lease or the database fails',async()=>{
    const task=vi.fn();execute.mockResolvedValue({rows:[]});await expect(withGuelphSession(task)).rejects.toThrow('busy');expect(task).not.toHaveBeenCalled();expect(execute).toHaveBeenCalledTimes(1);
    execute.mockRejectedValue(Error('offline'));await expect(withGuelphSession(task)).rejects.toThrow('offline');expect(task).not.toHaveBeenCalled();
  });
  it('renews ownership before further source reads and releases after success',async()=>{
    execute.mockResolvedValue({rows:[{key:'property-guelph-upstream'}]});expect(await withGuelphSession(async renew=>{await renew();expect(execute).toHaveBeenCalledTimes(1);vi.advanceTimersByTime(3000);await renew();expect(execute).toHaveBeenCalledTimes(2);return 'ok';})).toBe('ok');expect(execute).toHaveBeenCalledTimes(3);
  });
  it('stops source work after a lost lease and always attempts token-guarded release',async()=>{
    execute.mockResolvedValueOnce({rows:[{}]}).mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[]});let further=false;await expect(withGuelphSession(async renew=>{vi.advanceTimersByTime(3000);await renew();further=true;})).rejects.toThrow('lost');expect(further).toBe(false);expect(execute).toHaveBeenCalledTimes(3);
  });
  it('preserves source failure when releasing fails; short lease expiry retains exclusion',async()=>{
    execute.mockResolvedValueOnce({rows:[{}]}).mockRejectedValueOnce(Error('release offline'));await expect(withGuelphSession(async()=>{throw Error('source failed');})).rejects.toThrow('source failed');expect(execute).toHaveBeenCalledTimes(2);
  });
});
