$app.idleTimerDisabled = true;
const url = $clipboard.text;

function isFullURL(checkURL) {
    let targetURL = checkURL + "";
    return targetURL.indexOf("//") !== -1;
}

function downloadM3U8(url) {
    const errorMessage = `URL示例：http://1257120875.vod2.myqcloud.com/0ef121cdvodtransgzp1257120875/3055695e5285890780828799271/v.f230.m3u8`;

    if (!url) {
        $ui.alert({
            title: "剪贴板捕捉不到URL",
            message: errorMessage
        });
    }
    $console.info(`下载：${url}`);
    if (!url) {
        $ui.alert({
            title: "剪切板收集不到地址",
            message: errorMessage
        });
        return;
    }
    if (
        url
            .split("/")
            .pop()
            .indexOf(".m3u8") === -1
    ) {
        $ui.alert({
            title: "链接格式错误",
            message: errorMessage
        });
        return;
    }

    // 下载M3U8文件
    $http.get({
        url: url,
        header: {
            "USER-AGENT":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36"
        },
        handler: async function(resp) {
            $console.info(url);
            let data = resp.data;
            $console.info(data);
            if (data === "") {
                $console.info("m3u8 下载失败");
                $ui.alert({
                    title: "m3u8 下载失败",
                    message: "响应体为空。"
                });
                return;
            }

            let m3u8Data = data.split("\n");
            // 解析M3U8文件
            /* 包含m3u8
            1.弹出提示，让用户选择去下哪个m3u8
            */
            let m3u8List = [];
            for (const [i, line] of m3u8Data.entries()) {
                if (line.toUpperCase().indexOf("#EXT-X-STREAM-INF") > -1) {
                    m3u8List.push({ title: line, m3u8Link: m3u8Data[i + 1] });
                }
            }
            if (m3u8List.length > 0) {
                const { title, index } = await $ui.menu({
                    items: m3u8List.map(m => m.title)
                });
                const { m3u8Link } = m3u8List[index];
                let m3u8URL = "";
                if (isFullURL(m3u8Link)) {
                    m3u8URL = m3u8Link;
                } else {
                    m3u8URL = url.split("/");
                    m3u8URL.splice(m3u8URL.length - 1, 1, m3u8Link);
                    m3u8URL = m3u8URL.join("/");
                }

                $console.info(`Download ${title} ${m3u8URL}`);
                downloadM3U8(m3u8URL);
                return;
            }

            /* 包含ts
            1. 下载ts，并合并
            2. AES加解密研究。（需求可弃）
            */
            if (data.indexOf("#EXT-X-KEY") !== -1) {
                $ui.alert({
                    title: "下载失败",
                    message: "暂不支持加密的视频下载"
                });
                return;
            }
            let tsList = m3u8Data.filter(d => {
                return d.toLowerCase().indexOf(".ts") > -1;
            });
            tsList = tsList.map(d => {
                if (!isFullURL(d)) {
                    let baseURL = url.split("/");
                    baseURL.splice(baseURL.length - 1, 1, d);
                    d = baseURL.join("/");
                }
                return d;
            });
            if (tsList.length === 0) {
                $ui.alert({
                    title: "下载失败",
                    message: "捕捉不到ts文件"
                });
                return;
            }

            $ui.alert({
                title: "捕捉到M3U8资源",
                message: data,
                actions: [
                    {
                        title: "下载",
                        handler: async function() {
                            if (tsList.length > 0) {
                                $console.info("Start download TS files.");
                                $console.info(tsList);

                                const downloadTS = url => {
                                    return new Promise(function(
                                        resolve,
                                        reject
                                    ) {
                                        $http.download({
                                            url: url,
                                            header: {
                                                "USER-AGENT":
                                                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36"
                                            },
                                            showsProgress: false,
                                            handler: function(resp) {
                                                let file = resp.data;
                                                if (
                                                    +resp.response
                                                        .statusCode !== 200
                                                ) {
                                                    reject(
                                                        resp.response.statusCode
                                                    );
                                                }
                                                resolve(file);
                                            }
                                        });
                                    });
                                };

                                // 下载并存储ts文件
                                if ($file.exists("tmpl")) {
                                    $file.delete("tmpl");
                                }
                                if (!$file.exists("tmpl")) {
                                    $file.mkdir("tmpl");
                                }
                                let filesPath = [];
                                for (let idx = 0; idx < tsList.length; idx++) {
                                    let tsURL = tsList[idx];
                                    try {
                                        $ui.loading(
                                            `${idx + 1}/${tsList.length}`
                                        );
                                        let tsFile = await downloadTS(tsURL);
                                        const path = `tmpl/${idx + 1}.ts`;
                                        $file.write({
                                            data: tsFile,
                                            path: path
                                        });
                                        $console.info(`${path} 保存成功`);
                                        filesPath.push(path);
                                        $ui.loading(false);
                                    } catch (error) {
                                        $console.error(
                                            `${error} 下载失败 ${tsURL}`
                                        );
                                        idx--;
                                    }
                                }

                                if (filesPath.length !== tsList.length) {
                                    $ui.alert({
                                        title: "下载失败",
                                        message: "服务有误"
                                    });
                                    return;
                                }
                                // 合并文件
                                const fileName = `dest-${Date.now()}.ts`;
                                $file.merge({
                                    files: filesPath,
                                    dest: `tmpl/${fileName}`
                                });
                                $console.info(`下载完成`);
                                var file = $file.read(`tmpl/${fileName}`);
                                $share.sheet([fileName, file]);
                            }
                        }
                    },
                    {
                        title: "Cancel",
                        handler: function() {}
                    }
                ]
            });
        }
    });
}

downloadM3U8(url);
