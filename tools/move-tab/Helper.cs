using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ClassYesMove
{
    /// <summary>
    /// Keeps the Move tab on the floating class goal: looks for the window twice a second while it is
    /// closed, and while it is open keeps the tab against its bottom edge (its top edge when the window
    /// is near the bottom of the screen), following it as it grows for Get Ready! and shrinks back.
    /// </summary>
    internal sealed class Helper : IDisposable
    {
        public readonly MoveTab Tab = new MoveTab();
        public IntPtr Target { get; private set; }
        readonly Timer timer = new Timer { Interval = 40 };
        int ticks;
        Native.RECT lastBounds;

        public Helper()
        {
            Tab.CreateControl();
            timer.Tick += (_, __) => Tick();
            timer.Start();
        }

        void Tick()
        {
            ticks++;
            if (Tab.Dragging) return;
            if (!Alive(Target))
            {
                if (Target != IntPtr.Zero)
                {
                    Target = IntPtr.Zero;
                    Tab.Target = IntPtr.Zero;
                    Tab.Hide();
                }
                // Looking costs a walk over every window, so only twice a second.
                if (ticks % 12 != 0) return;
                Target = FloatFinder.Find(Tab.Handle);
                Tab.Target = Target;
                if (Target == IntPtr.Zero) return;
                lastBounds = default;
            }
            Place();
        }

        static bool Alive(IntPtr hWnd) => hWnd != IntPtr.Zero && Native.IsWindow(hWnd) && Native.IsWindowVisible(hWnd) && !Native.IsIconic(hWnd);

        /// <summary>Against the window's visible edge, centred, and on the screen.</summary>
        public void Place()
        {
            var v = Native.VisibleBounds(Target);
            uint dpi = Native.GetDpiForWindow(Target);
            Tab.SetScale(dpi > 0 ? dpi / 96.0 : 1);
            bool moved = !v.Equals(lastBounds);
            lastBounds = v;
            var work = Native.WorkAreaOf(Target);
            bool above = v.Bottom + Tab.Height > work.Bottom;
            Tab.SetAbove(above);
            int x = Math.Max(work.Left, Math.Min(work.Right - Tab.Width, v.Left + (v.Width - Tab.Width) / 2));
            int y = above ? v.Top - Tab.Height : v.Bottom;
            if (!Tab.Visible)
            {
                Tab.Location = new Point(x, y);
                Tab.Show();
            }
            if (moved || Tab.Left != x || Tab.Top != y || ticks % 25 == 0)
                // Kept on top of everything, the floating window included, without taking the focus.
                Native.SetWindowPos(Tab.Handle, Native.HWND_TOPMOST, x, y, 0, 0, Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
        }

        public void Dispose()
        {
            timer.Dispose();
            Tab.Dispose();
        }
    }

    /// <summary>The helper as the teacher runs it: the tab, and a small icon by the clock to see what it sees or quit.</summary>
    internal sealed class TrayApp : ApplicationContext
    {
        readonly Helper helper = new Helper();
        readonly NotifyIcon icon;

        public TrayApp()
        {
            var menu = new ContextMenuStrip();
            menu.Items.Add(new ToolStripMenuItem("Class? Yes! Move tab") { Enabled = false });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("What the helper sees", null, (_, __) => ShowReport());
            menu.Items.Add("Quit", null, (_, __) => ExitThread());
            icon = new NotifyIcon
            {
                Icon = MakeIcon(),
                Text = "Class? Yes! Move tab",
                ContextMenuStrip = menu,
                Visible = true,
            };
            icon.MouseClick += (_, e) =>
            {
                if (e.Button == MouseButtons.Left) ShowReport();
            };
            // Started from a link, a program that shows nothing looks as if it didn't start.
            icon.ShowBalloonTip(
                8000,
                "The Move tab is on",
                "Tap Float in Class? Yes!: a Move tab appears under the floating window. Slide it to move the window.",
                ToolTipIcon.Info
            );
        }

        void ShowReport()
        {
            string report = FloatFinder.Report(helper.Target, helper.Tab.Handle);
            try
            {
                Clipboard.SetText(report);
            }
            catch
            {
                // The clipboard is busy: the report still shows.
            }
            MessageBox.Show(report + "\n(This is copied, so it can be pasted into a message.)", "What the helper sees");
        }

        /// <summary>The tab's own picture, purple with the four-way arrow, drawn rather than shipped as a file.</summary>
        static Icon MakeIcon()
        {
            using (var bmp = new Bitmap(32, 32))
            using (var g = Graphics.FromImage(bmp))
            using (var fill = new SolidBrush(Color.FromArgb(124, 58, 237)))
            using (var pen = new Pen(Color.White, 2.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.FillEllipse(fill, 1, 1, 30, 30);
                g.DrawLine(pen, 8, 16, 24, 16);
                g.DrawLine(pen, 16, 8, 16, 24);
                foreach (var (x, y, dx, dy) in new[] { (24, 16, -1, 0), (8, 16, 1, 0), (16, 24, 0, -1), (16, 8, 0, 1) })
                {
                    g.DrawLine(pen, x, y, x + dx * 4 + dy * 4, y + dy * 4 + dx * 4);
                    g.DrawLine(pen, x, y, x + dx * 4 - dy * 4, y + dy * 4 - dx * 4);
                }
                return Icon.FromHandle(bmp.GetHicon());
            }
        }

        protected override void ExitThreadCore()
        {
            icon.Visible = false;
            icon.Dispose();
            helper.Dispose();
            base.ExitThreadCore();
        }
    }
}
