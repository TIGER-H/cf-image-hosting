import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";

type Bindings = {
  API_HOST: string;
  universe: KVNamespace;
};

const app = new Hono<{
  Bindings: Bindings;
}>();

app.get("/*", serveStatic({ root: "./" }));

app.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;
  const formData = new FormData();
  formData.append("file", file, file.name);
  const res = await fetch(`${c.env.API_HOST}/upload`, {
    method: "POST",
    body: formData,
  });

  const resClone = res.clone();

  const data = (await resClone.json()) satisfies Array<{ src: string }>;
  const tgphPath = data[0].src.split("/").pop();
  if (!tgphPath) throw new Error("tgphPath not found");

  // // upload to KV
  // // key: filename, value: tgphName
  // // @ts-ignore
  await c.env.universe.put(file.name.split(".")[0], tgphPath);

  return res;
});

app.get("/file/:tgphPath", (c) => {
  return fetch(`${c.env.API_HOST}/file/${c.req.param("tgphPath")}`);
});

app.get("/kv/:name", async (c) => {
  // @ts-ignore
  const tgphName = await c.env.universe.get(c.req.param("name"));
  return fetch(`${c.env.API_HOST}/file/${tgphName}`);
});

export default app;
