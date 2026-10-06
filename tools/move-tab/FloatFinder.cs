using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;

namespace ClassYesMove
{
    /// <summary>One window the helper looked at, for "What the helper sees".</summary>
    internal sealed class SeenWindow
    {
        public IntPtr Handle;
        public string Program, Class, Title;
        public Native.RECT Bounds;
        public bool Topmost, Resizable;

        public override string ToString() =>
            $"{Program} | {Class} | \"{Title}\" | {Bounds} | {(Topmost ? "on top" : "not on top")} | {(Resizable ? "resizable" : "fixed size")}";
    }

    /// <summary>
    /// Finds the floating class goal: Chrome's (or Edge's) always-on-top window that the app opens
    /// with the title "Class Goal". A page can't move that window - the browsers forbid it - but a
    /// program on the same computer may, which is all this helper does.
    /// </summary>
    internal static class FloatFinder
    {
        /// <summary>The title the app gives its floating window (useFloatingWindow.ts).</summary>
        public const string TitleMark = "Class Goal";
        static readonly string[] Browsers = { "chrome.exe", "msedge.exe" };

        /// <summary>The self-test's stand-in window, in this program, counts as the floating window.</summary>
        public static bool TestMode;

        /// <summary>How the last window was found, for the diagnostics.</summary>
        public static string LastRule = "";

        public static IntPtr Find(params IntPtr[] ours)
        {
            var seen = Look(ours);
            var titled = seen.FirstOrDefault((w) => w.Topmost && w.Title.IndexOf(TitleMark, StringComparison.OrdinalIgnoreCase) >= 0);
            if (titled != null)
            {
                LastRule = "on top, titled \"" + TitleMark + "\"";
                return titled.Handle;
            }
            // If Chrome labels the window some other way, the one resizable on-top browser window
            // that isn't nearly the whole screen is it. Never a guess between two.
            var others = seen.Where((w) => w.Topmost && w.Resizable && !NearlyWholeScreen(w)).ToList();
            if (others.Count == 1)
            {
                LastRule = "the only resizable on-top browser window";
                return others[0].Handle;
            }
            LastRule = "";
            return IntPtr.Zero;
        }

        /// <summary>Every visible browser window, on top or not.</summary>
        public static List<SeenWindow> Look(params IntPtr[] ours)
        {
            var found = new List<SeenWindow>();
            int self = Process.GetCurrentProcess().Id;
            Native.EnumWindows((hWnd, _) =>
            {
                if (ours.Contains(hWnd) || !Native.IsWindowVisible(hWnd) || Native.IsIconic(hWnd)) return true;
                Native.GetWindowThreadProcessId(hWnd, out uint pid);
                bool stand = TestMode && pid == self;
                string program = stand ? "self-test" : Native.ProgramOf(hWnd);
                if (!stand && !Browsers.Contains(program)) return true;
                string cls = Native.ClassOf(hWnd);
                if (!stand && cls != "Chrome_WidgetWin_1") return true;
                Native.GetWindowRect(hWnd, out Native.RECT r);
                if (r.Width < 40 || r.Height < 30) return true;
                found.Add(new SeenWindow
                {
                    Handle = hWnd,
                    Program = program,
                    Class = cls,
                    Title = Native.TitleOf(hWnd),
                    Bounds = r,
                    Topmost = (Native.ExStyle(hWnd) & Native.WS_EX_TOPMOST) != 0,
                    Resizable = (Native.Style(hWnd) & Native.WS_THICKFRAME) != 0,
                });
                return true;
            }, IntPtr.Zero);
            return found;
        }

        static bool NearlyWholeScreen(SeenWindow w)
        {
            var work = Native.WorkAreaOf(w.Handle);
            return w.Bounds.Width >= work.Width * 0.9 && w.Bounds.Height >= work.Height * 0.9;
        }

        /// <summary>A plain-text report of what the helper can see, for the teacher to send.</summary>
        public static string Report(IntPtr current, params IntPtr[] ours)
        {
            var sb = new StringBuilder();
            sb.AppendLine("Class? Yes! Move tab " + typeof(FloatFinder).Assembly.GetName().Version);
            sb.AppendLine(current != IntPtr.Zero ? "Found the floating window (" + LastRule + ")." : "Not found the floating window yet.");
            sb.AppendLine();
            sb.AppendLine("Browser windows it can see:");
            var seen = Look(ours);
            if (seen.Count == 0) sb.AppendLine("  none");
            foreach (var w in seen) sb.AppendLine("  " + (w.Handle == current ? "-> " : "   ") + w);
            return sb.ToString();
        }
    }
}
