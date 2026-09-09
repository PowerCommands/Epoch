# Thailand and the Korean nations

Definitions live in `src/data/nations.ts` and `src/data/asianLeaders.ts`.
The three new leaders use the existing agenda, doctrine, covert personality and
era-strategy systems. Their gameplay personalities, sports preferences and
fictional dialogue are game interpretations, not factual claims or quotations.
They confer no starting technologies, units or resources and do not prescribe
relations with specific nations.

Leader identity sources, checked for the September 9, 2026 scenario update:

- [Royal Thai Government: Anutin Charnvirakul](https://www.thaigov.go.th/en/news/162464).
- [South Korean Presidency: Lee Jae Myung](https://en.president.go.kr/president).
- [AP, September 7, 2026: Kim Jong Un](https://apnews.com/article/5c3ab31efd058e734ac645991fd22567).

## Flags

National flag SVGs were downloaded from FlagCDN (`th.svg`, `kr.svg`, `kp.svg`)
and stored locally as `public/assets/sprites/flags/{thailand,south-korea,north-korea}.svg`.
Matching PNGs at 128 pixels high are used by the UI and registered by the existing
raster sprite manifest generator; the SVGs are retained as source artwork.
There are no runtime requests to FlagCDN. These are the service's conventional
national flag designs, including its 1:2 North Korean flag. A proposed 2026
North Korean construction variant on Wikimedia Commons was marked disputed;
it was not substituted for the established design.

- [Thailand SVG](https://flagcdn.com/th.svg)
- [South Korea SVG](https://flagcdn.com/kr.svg)
- [North Korea SVG](https://flagcdn.com/kp.svg)
- [South Korean Ministry of the Interior: flag construction](https://www.mois.go.kr/eng/sub/a03/nationalSymbol/screen.do)

## Generated artwork

Created with the built-in `image_gen` tool, one generation per asset. The existing
Benjamin Netanyahu portrait was inspected for the painted visual style. Final
portraits are packaged as 416×416 PNGs; room backgrounds as 1536×1024 WebPs.
No existing portrait or room asset was replaced.

Final files in `public/assets/sprites/leaders/`:

- `anutin-charnvirakul.png` and `anutin-charnvirakul-room.webp`
- `lee-jae-myung.png` and `lee-jae-myung-room.webp`
- `kim-jong-un.png` and `kim-jong-un-room.webp`

Portrait prompt template:

> Create a square 1024x1024 finished strategy game leader portrait of SUBJECT.
> Traditional realistic oil painting, visible fine brushwork, warm chiaroscuro,
> muted brown umber painterly background, chest-up three-quarter shoulders and
> face looking toward viewer, centered head fully in frame with generous space
> above hair, neutral composed expression, polished museum portrait, matching
> Epoch historical leader portraits. No lettering, no frame, no watermarks,
> one person. Save the output image and report its local file path.

Subjects used:

- Anutin Charnvirakul, Thai prime minister, recognizable round face, short black
  hair, dark business suit, white shirt and subdued blue tie.
- Lee Jae Myung, South Korean president, recognizable face, neatly parted dark
  hair with gray, thin rectangular eyeglasses, dark navy business suit, white
  shirt and blue tie.
- Kim Jong Un, North Korean leader, recognizable broad face, distinctive swept
  back undercut black hair, dark charcoal high collar jacket.

Room prompt template:

> Use case: stylized-concept. Create a finished wide 1536x1024 background painting
> for a historical strategy game's diplomacy screen: SCENE. Traditional realistic
> oil painting, fine visible brushwork, warm muted natural lighting, architectural
> perspective from seated visitor viewpoint. Empty room, quiet central negative
> space reserved for game UI and a leader portrait. No people, no portraits, no
> flags, no national emblems, no text, no watermarks. Polished and consistent with
> classic painted leader portraits. Report saved local output path.

Scenes used:

- Thai government reception room in Bangkok, warm teak paneling, tall windows
  with tropical garden view, restrained cream and gold furnishings.
- South Korean presidential reception room in Seoul, elegant dark wood detailing,
  cream upholstery, mountains and pine trees outside tall windows.
- North Korean government reception hall in Pyongyang, symmetrical tall cream
  stone columns, dark wood and deep red upholstery, restrained formal grandeur.

The interiors are artistic interpretations, not documentary depictions.
