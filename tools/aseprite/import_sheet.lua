-- Turn one of the game's horizontal sprite sheets into an editable .aseprite file (one frame per cell).
-- Run by tools/aseprite/make_sources.ps1:
--   Aseprite.exe -b --script-param png=... --script-param out=... --script-param w=74 --script-param h=65
--                   --script-param fps=12 --script tools/aseprite/import_sheet.lua
local p = app.params
local sheet = app.open(p.png)
if not sheet then
    print("could not open " .. tostring(p.png))
    return
end
local fw = tonumber(p.w)
local fh = tonumber(p.h)

-- Copy each cell of the strip into its own frame of a new sprite
local count = math.floor(sheet.width / fw)
local spr = Sprite(fw, fh, ColorMode.RGB)
spr.filename = p.out
local layer = spr.layers[1]
layer.name = "Ren"
for i = 0, count - 1 do
    local frame = (i == 0) and spr.frames[1] or spr:newEmptyFrame(i + 1)
    local img = Image(fw, fh, ColorMode.RGB)
    img:drawImage(sheet.cels[1].image, Point(-i * fw - sheet.cels[1].position.x, -sheet.cels[1].position.y))
    spr:newCel(layer, frame, img, Point(0, 0))
    frame.duration = 1 / tonumber(p.fps)
end
sheet:close()
spr:saveAs(p.out)
spr:close()
print(string.format("%s: %d frames", p.out, count))
