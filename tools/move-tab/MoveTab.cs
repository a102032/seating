using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace ClassYesMove
{
    /// <summary>
    /// The Move tab: a finger-sized handle that hangs off the floating class goal. A finger slid on it
    /// moves the floating window with it. It is not a title bar - Windows' own title bars are what a
    /// held finger turns into a right-click, and what Chrome cancels the move on - so it reads the
    /// finger itself and moves the window to match. Press-and-hold is switched off for it alone, and it
    /// never takes the focus, so the slideshow keeps it.
    /// </summary>
    internal sealed class MoveTab : Form
    {
        /// <summary>The tab's size at 100% scaling; real pixels are this times the screen's scale.</summary>
        public const int BaseWidth = 132, BaseHeight = 46;

        static readonly Color Purple = Color.FromArgb(124, 58, 237);
        static readonly Color PurpleDown = Color.FromArgb(91, 33, 182);

        /// <summary>The floating window it moves.</summary>
        public IntPtr Target;
        /// <summary>Hanging above the window rather than below it (the window is near the bottom of the screen).</summary>
        bool above;
        double scale = 1;

        bool dragging;
        uint pointerId;
        bool byMouse;
        Native.POINT start;
        Native.RECT targetStart;
        Point tabStart;

        public bool Dragging => dragging;
        /// <summary>Right-clicks and menus the tab was offered (and threw away): the self-test checks for none.</summary>
        public int RightClicks;
        /// <summary>The window was let go somewhere new.</summary>
        public event Action Dropped;

        public MoveTab()
        {
            Text = "Class? Yes! Move";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            AutoScaleMode = AutoScaleMode.None;
            DoubleBuffered = true;
            BackColor = Purple;
            Cursor = Cursors.SizeAll;
            SetScale(1);
        }

        protected override bool ShowWithoutActivation => true;

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                // Never takes the focus (the slideshow keeps it), not in the taskbar or Alt+Tab, always on top.
                cp.ExStyle |= (int)(Native.WS_EX_NOACTIVATE | Native.WS_EX_TOOLWINDOW | Native.WS_EX_TOPMOST);
                return cp;
            }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            // A held finger here is not a right-click, and no flick or tap ripple either.
            Native.SetProp(
                Handle,
                Native.TabletPenServiceProperty,
                new IntPtr(
                    Native.TABLET_DISABLE_PRESSANDHOLD
                        | Native.TABLET_DISABLE_PENTAPFEEDBACK
                        | Native.TABLET_DISABLE_PENBARRELFEEDBACK
                        | Native.TABLET_DISABLE_FLICKS
                )
            );
        }

        /// <summary>Sized for the screen the floating window is on: the teacher's board runs at 300%.</summary>
        public void SetScale(double next)
        {
            if (Math.Abs(next - scale) < 0.01 && Width > 0 && Region != null) return;
            scale = next;
            Size = new Size((int)Math.Round(BaseWidth * scale), (int)Math.Round(BaseHeight * scale));
            Shape();
            Invalidate();
        }

        public void SetAbove(bool next)
        {
            if (next == above) return;
            above = next;
            Shape();
            Invalidate();
        }

        /// <summary>Rounded on the side away from the window, square where it meets it, like a tab.</summary>
        void Shape()
        {
            using (var path = TabPath(new Rectangle(0, 0, Width, Height)))
                Region = new Region(path);
        }

        GraphicsPath TabPath(Rectangle r)
        {
            int rad = Math.Max(4, (int)(16 * scale));
            var p = new GraphicsPath();
            if (above)
            {
                // Rounded on top, square along the bottom where it meets the window.
                p.AddArc(r.Left, r.Top, rad * 2, rad * 2, 180, 90);
                p.AddArc(r.Right - rad * 2, r.Top, rad * 2, rad * 2, 270, 90);
                p.AddLine(r.Right, r.Bottom, r.Left, r.Bottom);
            }
            else
            {
                p.AddLine(r.Left, r.Top, r.Right, r.Top);
                p.AddArc(r.Right - rad * 2, r.Bottom - rad * 2, rad * 2, rad * 2, 0, 90);
                p.AddArc(r.Left, r.Bottom - rad * 2, rad * 2, rad * 2, 90, 90);
            }
            p.CloseFigure();
            return p;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
            g.Clear(dragging ? PurpleDown : Purple);
            // A thin white edge, so the tab shows on a dark slide as well as a light one.
            using (var edge = new Pen(Color.FromArgb(220, 255, 255, 255), Math.Max(1f, (float)(2 * scale))))
            using (var path = TabPath(new Rectangle(0, 0, Width - 1, Height - 1)))
                g.DrawPath(edge, path);

            // The four-way arrow, then the word.
            float s = (float)scale;
            float icon = 22 * s;
            float gap = 8 * s;
            using (var font = new Font("Segoe UI Semibold", 17 * s, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                SizeF word = g.MeasureString("Move", font);
                float total = icon + gap + word.Width;
                float x = (Width - total) / 2;
                float cy = Height / 2f;
                DrawArrows(g, x + icon / 2, cy, icon / 2, s);
                using (var white = new SolidBrush(Color.White))
                    g.DrawString("Move", font, white, x + icon + gap, cy - word.Height / 2);
            }
        }

        static void DrawArrows(Graphics g, float cx, float cy, float r, float s)
        {
            using (var pen = new Pen(Color.White, Math.Max(1.5f, 2.6f * s)) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
            {
                g.DrawLine(pen, cx - r, cy, cx + r, cy);
                g.DrawLine(pen, cx, cy - r, cx, cy + r);
                float h = r * 0.42f;
                foreach (var (dx, dy) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) })
                {
                    float tx = cx + dx * r, ty = cy + dy * r;
                    g.DrawLine(pen, tx, ty, tx - dx * h + dy * h, ty - dy * h + dx * h);
                    g.DrawLine(pen, tx, ty, tx - dx * h - dy * h, ty - dy * h - dx * h);
                }
            }
        }

        protected override void WndProc(ref Message m)
        {
            switch (m.Msg)
            {
                case Native.WM_MOUSEACTIVATE:
                    m.Result = new IntPtr(Native.MA_NOACTIVATE);
                    return;
                case Native.WM_POINTERDOWN:
                case Native.WM_POINTERUPDATE:
                case Native.WM_POINTERUP:
                    if (Pointer(ref m)) return;
                    break;
                case Native.WM_POINTERCAPTURECHANGED:
                    if (dragging && !byMouse) EndDrag();
                    break;
                case Native.WM_CONTEXTMENU:
                case Native.WM_RBUTTONDOWN:
                case Native.WM_RBUTTONUP:
                    RightClicks++;
                    m.Result = IntPtr.Zero;
                    return;
            }
            base.WndProc(ref m);
        }

        /// <summary>
        /// A finger or pen, read straight from Windows' pointer messages: answered here, they never
        /// become a mouse click, so nothing is waiting to turn a held finger into a right-click.
        /// </summary>
        bool Pointer(ref Message m)
        {
            uint id = (uint)(m.WParam.ToInt64() & 0xFFFF);
            if (!Native.GetPointerInfo(id, out Native.POINTER_INFO info)) return false;
            if (info.pointerType != Native.PT_TOUCH && info.pointerType != Native.PT_PEN) return false;
            var at = info.ptPixelLocation;
            if (m.Msg == Native.WM_POINTERDOWN)
            {
                if (!dragging) BeginDrag(at, id, mouse: false);
            }
            else if (dragging && !byMouse && id == pointerId)
            {
                if (m.Msg == Native.WM_POINTERUPDATE) DragTo(at);
                else EndDrag();
            }
            m.Result = IntPtr.Zero;
            return true;
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button == MouseButtons.Left && !dragging) BeginDrag(CursorAt(), 0, mouse: true);
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (dragging && byMouse) DragTo(CursorAt());
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (dragging && byMouse && e.Button == MouseButtons.Left) EndDrag();
        }

        protected override void OnMouseCaptureChanged(EventArgs e)
        {
            base.OnMouseCaptureChanged(e);
            if (dragging && byMouse && !Capture) EndDrag();
        }

        static Native.POINT CursorAt()
        {
            var p = System.Windows.Forms.Cursor.Position;
            return new Native.POINT(p.X, p.Y);
        }

        void BeginDrag(Native.POINT at, uint id, bool mouse)
        {
            if (Target == IntPtr.Zero || !Native.GetWindowRect(Target, out targetStart)) return;
            dragging = true;
            byMouse = mouse;
            pointerId = id;
            start = at;
            tabStart = Location;
            Invalidate();
        }

        void DragTo(Native.POINT at)
        {
            int dx = at.X - start.X, dy = at.Y - start.Y;
            // Never further than leaves part of the window on some screen: it can't be lost off the edge.
            var all = SystemInformation.VirtualScreen;
            int keep = (int)(48 * scale);
            dx = Math.Max(all.Left - targetStart.Right + keep, Math.Min(all.Right - targetStart.Left - keep, dx));
            dy = Math.Max(all.Top - targetStart.Top, Math.Min(all.Bottom - targetStart.Top - keep, dy));
            Native.SetWindowPos(
                Target,
                IntPtr.Zero,
                targetStart.Left + dx,
                targetStart.Top + dy,
                0,
                0,
                Native.SWP_NOSIZE | Native.SWP_NOZORDER | Native.SWP_NOACTIVATE | Native.SWP_NOOWNERZORDER | Native.SWP_ASYNCWINDOWPOS
            );
            // The tab goes with the finger at once rather than waiting to hear where the window went.
            Native.SetWindowPos(Handle, Native.HWND_TOPMOST, tabStart.X + dx, tabStart.Y + dy, 0, 0, Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
        }

        void EndDrag()
        {
            if (!dragging) return;
            dragging = false;
            Invalidate();
            Dropped?.Invoke();
        }
    }
}
