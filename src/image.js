import { ImageResponse } from "workers-og";

const NAVY = "#0F1E3C";
const GOLD = "#D4AF37";

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
  const regex = /font-weight:\s*(\d+);[\s\S]*?src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/g;
  let match;
  while ((match = regex.exec(css))) {
    const weight = Number(match[1]);
    const data = await (await fetch(match[2])).arrayBuffer();
    fonts.push({ name: "Poppins", data, weight, style: "normal" });
  }
  return fonts;
}

export async function generateBrandImage(hookText) {
  const fonts = await loadGoogleFont(`MyActif${hookText}myactif.com · Diagnóstico gratuito`);

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
          backgroundColor: NAVY,
          padding: "70px",
          fontFamily: "Poppins"
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                fontSize: "44px",
                fontWeight: 700,
                color: GOLD,
                letterSpacing: "2px"
              },
              children: "MyActif"
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
                fontSize: "30px",
                fontWeight: 400,
                color: GOLD,
                justifyContent: "center"
              },
              children: "myactif.com · Diagnóstico gratuito"
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
