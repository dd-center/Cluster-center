# Cluster-center

## DD@Home, Cluster Manager

The cluster manager of Project ***DD@Home***. <!--Yes, this is inspired by Hentai@Home-->

### Available Clients

Desktop: <https://github.com/dd-center/DDatElectron>

Node: <https://github.com/dd-center/DDatHome-nodejs>

Go: <https://github.com/dd-center/DDatHome-go>

### Protocol

Websocket connection to `wss://cluster.vtbs.moe`

example:

```
cluster.vtbs.moe                    You
       |<----------Websocket---------|
       |<----------"DDhttp"----------|
       |             ...             |
       |------------[Task]---------->|
       |             ...             |
       |<---------[Complete]---------|
       |<----------"DDhttp"----------|
       |             ...             |
       |------------[Task]---------->|
       |             ...             |
       |<---------[Complete]---------|
       |<----------"DDhttp"----------|
       |             ...             |
       |             ...             |
```



#### Pull task:

Send String: `DDhttp` for more http task.

Every new task is pulled by client using `DDhttp`, it is possible to pull mutiple tasks at the same time.

After pulling task, soon or later tasks will be distributed through WebSocket with a pack encoded in json.

Only 1 task will be send per pulls.

#### Task distribution:

Receive, format: `json`.

```json
{
  "key": "SomeRandomString",
  "data": {
    "type": "http",
    "url": "some bilibili url"
  }
}
```

Example:

```json
{
  "key": "0.28634934784",
  "data": {
    "type": "http",
    "url": "https://api.bilibili.com/x/space/acc/info?mid=349991143",
  }
}
```

#### Completing Task:

Send, format: `json`.

Make sure the key is same for each task.

```json
{
  "key": "SomeRandomString",
  "data": "hereIsResult" // String
}
```

Example:

```json
{
  "key": "0.28634934784",
  "data": "{\"code\":0,\"message\":\"0\",\"ttl\":1,\"data\":{\"mid\":349991143,\"name\":\"神楽Mea_Official\",\"sex\":\"女\",\"face\":\"http://i1.hdslb.com/bfs/face/4b951570bf09e0ca7fad2a0ae2b1cad3a7a9006b.jpg\",\"sign\":\"你的人生前路未免太过灰暗了吧？\",\"rank\":10000,\"level\":6,\"jointime\":0,\"moral\":0,\"silence\":0,\"birthday\":\"08-02\",\"coins\":0,\"fans_badge\":true,\"official\":{\"role\":1,\"title\":\"bilibili 知名UP主\",\"desc\":\"\"},\"vip\":{\"type\":2,\"status\":1,\"theme_type\":0},\"is_followed\":false,\"top_photo\":\"http://i0.hdslb.com/bfs/space/cde2a0fe3273ae4466d135541d965e21c58a7454.png\",\"theme\":{},\"sys_notice\":{}}}"
}

```

