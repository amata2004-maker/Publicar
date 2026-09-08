import { ImageResponse } from "workers-og";

const BLUE = "#3D5FE0";
const ORANGE = "#E8784A";
const LOGO_URL = "https://raw.githubusercontent.com/amata2004-maker/publicar/main/logo.png";
const LOGO_WIDTH = 340;
const LOGO_HEIGHT = 152; // proporción real del logo: 406x181

async function loadLogoDataUri() {
  const res = await fetch(LOGO_URL);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/png;base64,${btoa(binary)}`;
}

// Satori (usado por workers-og) no tiene acceso a fuentes del sistema —
// hay que traerlas nosotros. Google sirve TTF en vez de WOFF2 si el
// User-Agent parece un navegador viejo; Satori solo entiende TTF/OTF/WOFF.
async function loadGoogleFont(text) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&text=${encodeURIComponent(text)}`;
  const css = await (
    await fetch(cssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36"
      }
    })
  ).text();

  const fonts = [];
  const regex = /font-weight:\s*(\d+);[\s\S]*?src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype|woff)'\)/g;
  let match;
  while ((match = regex.exec(css))) {
    const weight = Number(match[1]);
    const data = await (await fetch(match[2])).arrayBuffer();
    fonts.push({ name: "Poppins", data, weight, style: "normal" });
  }
  return fonts;
}

export async function generateBrandImage(hookText) {
  const [fonts, logoDataUri] = await Promise.all([
    loadGoogleFont(`${hookText}myactif.com · Diagnóstico gratuito`),
    loadLogoDataUri()
  ]);

  return new ImageResponse(
    {
      type: "div",
      props: {
        style: {
          width: "1080px",
          height: "1080px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BLUE,
          padding: "70px",
          fontFamily: "Poppins"
        },
        children: [
          {
            type: "img",
            props: {
              src: logoDataUri,
              width: LOGO_WIDTH,
              height: LOGO_HEIGHT,
              style: { display: "flex" }
            }
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: "0 10px"
              },
              children: {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: "58px",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    lineHeight: 1.35,
                    textAlign: "center"
                  },
                  children: hookText
                }
              }
            }
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                justifyContent: "center"
              },
              children: {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    backgroundColor: ORANGE,
                    color: "#FFFFFF",
                    fontSize: "28px",
                    fontWeight: 700,
                    padding: "16px 32px",
                    borderRadius: "999px"
                  },
                  children: "myactif.com · Diagnóstico gratuito"
                }
              }
            }
          }
        ]
      }
    },
    {
      width: 1080,
      height: 1080,
      fonts
    }
  );
}
