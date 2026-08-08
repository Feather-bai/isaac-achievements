import { Context } from 'hono';
import { BlankInput } from 'hono/types';

export type Bindings = {
  // 本应用无持久化绑定，仅保留类型声明以对齐模板结构
};

export type Ctx<P extends string = any> = Context<
  {
    Bindings: Bindings;
  },
  P,
  BlankInput
>;
