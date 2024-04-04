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
  const tgphUploadPath = data[0].src.split("/").pop();
  if (!tgphUploadPath) throw new Error("upload path not found");

  // upload to KV
  // tgphKVKey: filename, tgphKVValue: tgphUploadPath
  const tgphKVKey = file.name.split(".")[0];
  const tgphKVValue = await c.env.universe.get(tgphKVKey);
  if (!tgphKVValue) {
    await c.env.universe.put(tgphKVKey, tgphUploadPath);
  }
  return res;
});

app.get("/file/:tgphUploadPath", (c) => {
  return fetch(`${c.env.API_HOST}/file/${c.req.param("tgphUploadPath")}`);
});

app.get("/kv/:key", async (c) => {
  const kvValue = await c.env.universe.get(c.req.param("key"));
  return fetch(`${c.env.API_HOST}/file/${kvValue}`);
});

export default app;
