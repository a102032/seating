using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;

namespace ClassYesMove
{
    /// <summary>
    /// The Move tab's picture, a hand sliding (the teacher's pick from Flaticon), drawn from the
    /// outline in design/move-hand.svg, which is built into the program. Drawn rather than shipped as
    /// a bitmap so it stays sharp at any scale: the teacher's board runs at 300%.
    /// </summary>
    internal static class HandIcon
    {
        /// <summary>The SVG's own box: its outline runs from 0 to this on both sides.</summary>
        const float Box = 365.502f;

        static GraphicsPath shape;

        static GraphicsPath Shape => shape ?? (shape = Load());

        /// <summary>How many points the outline has, for the self-test: none means the SVG wasn't built in.</summary>
        public static int Points => Shape.PointCount;

        /// <summary>Filled in the given box, kept square and centred in it.</summary>
        public static void Draw(Graphics g, RectangleF box, Brush brush)
        {
            float side = System.Math.Min(box.Width, box.Height);
            var state = g.Save();
            g.TranslateTransform(box.X + (box.Width - side) / 2, box.Y + (box.Height - side) / 2);
            g.ScaleTransform(side / Box, side / Box);
            g.FillPath(brush, Shape);
            g.Restore(state);
        }

        static GraphicsPath Load()
        {
            string svg;
            using (var stream = typeof(HandIcon).Assembly.GetManifestResourceStream("move-hand.svg"))
            using (var reader = new StreamReader(stream))
                svg = reader.ReadToEnd();
            // The SVG's own rule: a shape inside another, wound the other way, is a hole.
            var path = new GraphicsPath(FillMode.Winding);
            foreach (Match d in Regex.Matches(svg, "\\sd=\"([^\"]+)\"")) Add(path, d.Groups[1].Value);
            return path;
        }

        /// <summary>The SVG path commands an icon outline uses: moves, lines and curves, absolute or relative.</summary>
        static void Add(GraphicsPath path, string d)
        {
            var tokens = new List<string>();
            foreach (Match t in Regex.Matches(d, @"[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")) tokens.Add(t.Value);
            int i = 0;
            char cmd = 'M';
            PointF cur = PointF.Empty, start = PointF.Empty, lastControl = PointF.Empty;
            bool lastWasCurve = false;

            float Num() => float.Parse(tokens[i++], CultureInfo.InvariantCulture);
            PointF Pt(bool rel)
            {
                float x = Num(), y = Num();
                return rel ? new PointF(cur.X + x, cur.Y + y) : new PointF(x, y);
            }

            while (i < tokens.Count)
            {
                if (char.IsLetter(tokens[i][0])) cmd = tokens[i++][0];
                bool rel = char.IsLower(cmd);
                bool curve = false;
                switch (char.ToUpperInvariant(cmd))
                {
                    case 'M':
                        path.StartFigure();
                        cur = start = Pt(rel);
                        // Numbers after a move are lines.
                        cmd = rel ? 'l' : 'L';
                        break;
                    case 'L':
                    {
                        var p = Pt(rel);
                        path.AddLine(cur, p);
                        cur = p;
                        break;
                    }
                    case 'H':
                    {
                        float x = Num();
                        var p = new PointF(rel ? cur.X + x : x, cur.Y);
                        path.AddLine(cur, p);
                        cur = p;
                        break;
                    }
                    case 'V':
                    {
                        float y = Num();
                        var p = new PointF(cur.X, rel ? cur.Y + y : y);
                        path.AddLine(cur, p);
                        cur = p;
                        break;
                    }
                    case 'C':
                    {
                        var c1 = Pt(rel);
                        var c2 = Pt(rel);
                        var p = Pt(rel);
                        path.AddBezier(cur, c1, c2, p);
                        lastControl = c2;
                        cur = p;
                        curve = true;
                        break;
                    }
                    case 'S':
                    {
                        var c1 = lastWasCurve ? new PointF(2 * cur.X - lastControl.X, 2 * cur.Y - lastControl.Y) : cur;
                        var c2 = Pt(rel);
                        var p = Pt(rel);
                        path.AddBezier(cur, c1, c2, p);
                        lastControl = c2;
                        cur = p;
                        curve = true;
                        break;
                    }
                    case 'Z':
                        path.CloseFigure();
                        cur = start;
                        // Z takes no numbers: anything but a command after it is skipped.
                        while (i < tokens.Count && !char.IsLetter(tokens[i][0])) i++;
                        break;
                    default:
                        // A command an icon outline doesn't use: skip it and its numbers.
                        while (i < tokens.Count && !char.IsLetter(tokens[i][0])) i++;
                        break;
                }
                lastWasCurve = curve;
            }
        }
    }
}
