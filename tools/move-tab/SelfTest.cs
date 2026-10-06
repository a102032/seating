using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ClassYesMove
{
    /// <summary>
    /// The helper checked on a real Windows desktop (GitHub's Windows computers), since none can be
    /// reached from where it is written: a stand-in "Class Goal" window, the tab found and hung off it,
    /// then dragged by mouse and by a touch held still first - long enough for Windows' press-and-hold.
    /// Writes results.txt and screenshots to the folder given, and exits with the number of failures.
    /// </summary>
    internal sealed class SelfTest
    {
        readonly string dir;
        readonly StringBuilder log = new StringBuilder();
        int failures;
        Form stand;
        Helper helper;

        SelfTest(string dir) => this.dir = dir;

        public static int Run(string dir)
        {
            Directory.CreateDirectory(dir);
            FloatFinder.TestMode = true;
            var test = new SelfTest(dir);
            test.Start();
            Application.Run();
            File.WriteAllText(Path.Combine(dir, "results.txt"), test.log.ToString());
            return test.failures;
        }

        void Check(string name, bool ok, string detail = "")
        {
            if (!ok) failures++;
            log.AppendLine((ok ? "OK   " : "FAIL ") + name + (detail.Length > 0 ? " - " + detail : ""));
        }

        void Note(string text) => log.AppendLine("     " + text);

        void Start()
        {
            stand = new Form
            {
                Text = "Class Goal (self-test stand-in)",
                TopMost = true,
                FormBorderStyle = FormBorderStyle.Sizable,
                StartPosition = FormStartPosition.Manual,
                AutoScaleMode = AutoScaleMode.None,
                BackColor = Color.FromArgb(237, 233, 254),
                ShowInTaskbar = true,
            };
            stand.Shown += async (_, __) =>
            {
                try
                {
                    await Steps();
                }
                catch (Exception ex)
                {
                    Check("runs without a crash", false, ex.ToString());
                }
                finally
                {
                    helper?.Dispose();
                    if (!stand.IsDisposed) stand.Close();
                    Application.ExitThread();
                }
            };
            stand.Show();
        }

        double Scale() => Native.GetDpiForWindow(stand.Handle) / 96.0;

        async Task Steps()
        {
            Note("Windows " + Environment.OSVersion.Version + ", screen " + Screen.PrimaryScreen.Bounds + ", scale " + Scale());
            double s = Scale();
            stand.Bounds = new Rectangle(300, 220, (int)(340 * s), (int)(180 * s));
            Note("before the tab, " + Focus());
            helper = new Helper();
            MoveTab tab = helper.Tab;

            bool found = await WaitFor(() => helper.Target == stand.Handle && tab.Visible, 4000);
            Check("finds the floating window and hangs the tab off it", found, FloatFinder.LastRule);
            if (!found)
            {
                Note(FloatFinder.Report(helper.Target, tab.Handle));
                return;
            }
            await Task.Delay(300);
            Note("tab shown, " + Focus());
            Shot("1-attached");
            CheckAttached("the tab sits centred under the window", below: true);

            // A mouse drag, through Windows' own input.
            var before = Window();
            var c = Centre(tab);
            int dx = (int)(180 * s), dy = (int)(-110 * s);
            Native.SetCursorPos(c.X, c.Y);
            await Task.Delay(60);
            // Pressed and moved straight away, as a quick flick would be.
            Mouse(Native.MOUSEEVENTF_LEFTDOWN);
            for (int i = 1; i <= 12; i++)
            {
                Native.SetCursorPos(c.X + dx * i / 12, c.Y + dy * i / 12);
                await Task.Delay(25);
            }
            Mouse(Native.MOUSEEVENTF_LEFTUP);
            await Task.Delay(400);
            Note("mouse up, " + Focus());
            var after = Window();
            Check("a mouse drag on the tab moves the window", Near(after.Left - before.Left, dx) && Near(after.Top - before.Top, dy), $"moved {after.Left - before.Left},{after.Top - before.Top} for {dx},{dy}");
            Shot("2-after-mouse-drag");
            await Task.Delay(1200);
            var later = Window();
            Check("the window stays where it was dropped", later.Left == after.Left && later.Top == after.Top, $"{after} then {later}");
            CheckAttached("the tab came with it", below: true);
            Check("the tab never takes the focus", GetForegroundWindow() != tab.Handle);

            // A finger held still on the tab first - longer than Windows' press-and-hold - then slid.
            if (Native.InitializeTouchInjection(1, 3))
            {
                before = Window();
                c = Centre(tab);
                int tx = (int)(-150 * s), ty = (int)(80 * s);
                bool ok = Touch(c, Native.POINTER_FLAG_DOWN | Native.POINTER_FLAG_INRANGE | Native.POINTER_FLAG_INCONTACT);
                for (int i = 0; i < 40 && ok; i++)
                {
                    await Task.Delay(40);
                    ok = Touch(c, Native.POINTER_FLAG_UPDATE | Native.POINTER_FLAG_INRANGE | Native.POINTER_FLAG_INCONTACT);
                }
                for (int i = 1; i <= 12 && ok; i++)
                {
                    await Task.Delay(25);
                    ok = Touch(new Point(c.X + tx * i / 12, c.Y + ty * i / 12), Native.POINTER_FLAG_UPDATE | Native.POINTER_FLAG_INRANGE | Native.POINTER_FLAG_INCONTACT);
                }
                if (ok) ok = Touch(new Point(c.X + tx, c.Y + ty), Native.POINTER_FLAG_UP);
                await Task.Delay(500);
                if (!ok)
                {
                    Note("Touch injection failed on this computer (error " + Marshal.GetLastWin32Error() + "): the touch check was skipped.");
                }
                else
                {
                    after = Window();
                    Check("a finger held still, then slid, moves the window", Near(after.Left - before.Left, tx) && Near(after.Top - before.Top, ty), $"moved {after.Left - before.Left},{after.Top - before.Top} for {tx},{ty}");
                    Check("a held finger gives the tab no right-click or menu", tab.RightClicks == 0, $"{tab.RightClicks} right-clicks");
                    Check("and the tab still hasn't taken the focus", GetForegroundWindow() != tab.Handle);
                    Shot("3-after-touch-drag");
                    await Task.Delay(1200);
                    later = Window();
                    Check("and the window stays there", later.Left == after.Left && later.Top == after.Top, $"{after} then {later}");
                }
            }
            else
            {
                Note("This computer can't inject touch (error " + Marshal.GetLastWin32Error() + "): the touch check was skipped.");
            }

            // Grown for Get Ready!, the tab follows.
            stand.Size = new Size((int)(700 * s), (int)(420 * s));
            await Task.Delay(400);
            CheckAttached("the tab follows the window as it grows", below: true);

            // Near the bottom of the screen, the tab hangs above it instead.
            var work = Screen.FromHandle(stand.Handle).WorkingArea;
            stand.Size = new Size((int)(340 * s), (int)(180 * s));
            stand.Location = new Point(stand.Left, work.Bottom - stand.Height - 4);
            await Task.Delay(400);
            Shot("4-near-the-bottom");
            CheckAttached("near the bottom of the screen the tab sits on top", below: false);

            // Closed, the tab goes.
            stand.Hide();
            bool gone = await WaitFor(() => !tab.Visible, 2000);
            Check("when the window closes, the tab goes", gone);
            Note(FloatFinder.Report(IntPtr.Zero, tab.Handle));
        }

        void CheckAttached(string name, bool below)
        {
            var v = Native.VisibleBounds(stand.Handle);
            var t = helper.Tab.Bounds;
            int edge = below ? t.Top - v.Bottom : v.Top - t.Bottom;
            int centre = (t.Left + t.Width / 2) - (v.Left + v.Width / 2);
            Check(name, Math.Abs(edge) <= 2 && Math.Abs(centre) <= 2, $"window {v}, tab {t}");
        }

        Native.RECT Window()
        {
            Native.GetWindowRect(stand.Handle, out Native.RECT r);
            return r;
        }

        static Point Centre(Control c) => new Point(c.Left + c.Width / 2, c.Top + c.Height / 2);
        static bool Near(int actual, int wanted) => Math.Abs(actual - wanted) <= 3;

        static async Task<bool> WaitFor(Func<bool> done, int ms)
        {
            var clock = Stopwatch.StartNew();
            while (clock.ElapsedMilliseconds < ms)
            {
                if (done()) return true;
                await Task.Delay(40);
            }
            return done();
        }

        static void Mouse(uint flags)
        {
            var input = new[] { new Native.INPUT { type = Native.INPUT_MOUSE, mi = new Native.MOUSEINPUT { dwFlags = flags } } };
            Native.SendInput(1, input, Marshal.SizeOf(typeof(Native.INPUT)));
        }

        static bool Touch(Point at, uint flags)
        {
            var contact = new Native.POINTER_TOUCH_INFO();
            contact.pointerInfo.pointerType = Native.PT_TOUCH;
            contact.pointerInfo.pointerId = 0;
            contact.pointerInfo.pointerFlags = flags;
            contact.pointerInfo.ptPixelLocation = new Native.POINT(at.X, at.Y);
            contact.touchMask = Native.TOUCH_MASK_CONTACTAREA | Native.TOUCH_MASK_ORIENTATION | Native.TOUCH_MASK_PRESSURE;
            contact.orientation = 90;
            contact.pressure = 32000;
            contact.rcContact = new Native.RECT { Left = at.X - 4, Top = at.Y - 4, Right = at.X + 4, Bottom = at.Y + 4 };
            return Native.InjectTouchInput(1, new[] { contact });
        }

        void Shot(string name)
        {
            try
            {
                var all = SystemInformation.VirtualScreen;
                using (var bmp = new Bitmap(all.Width, all.Height))
                using (var g = Graphics.FromImage(bmp))
                {
                    g.CopyFromScreen(all.Left, all.Top, 0, 0, all.Size);
                    bmp.Save(Path.Combine(dir, name + ".png"), ImageFormat.Png);
                }
            }
            catch (Exception ex)
            {
                Note("No screenshot " + name + ": " + ex.Message);
            }
        }

        static IntPtr GetForegroundWindow() => Native.GetForegroundWindow();

        /// <summary>Which window has the focus, by name.</summary>
        string Focus()
        {
            var f = Native.GetForegroundWindow();
            string who = f == IntPtr.Zero ? "none" : f == stand.Handle ? "the stand-in" : helper != null && f == helper.Tab.Handle ? "THE TAB" : "\"" + Native.TitleOf(f) + "\" (" + Native.ClassOf(f) + ")";
            return "focus: " + who;
        }
    }
}
