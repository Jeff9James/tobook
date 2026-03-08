-- filters/scene-break.lua
-- Replaces horizontal rules (---) with a scene break.

function HorizontalRule(el)
  if FORMAT == 'latex' or FORMAT == 'pdf' then
    return pandoc.RawBlock('latex', '\\scenebreak')
  elseif FORMAT == 'epub' or FORMAT == 'html' then
    return pandoc.RawBlock('html', '<p class="scene-break"><span>* * *</span></p>')
  else
    return nil
  end
end
