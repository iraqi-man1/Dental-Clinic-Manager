using System.Windows;
using NargisClinic.Desktop.ViewModels;

namespace NargisClinic.Desktop.Views;

public partial class ShellWindow : Window
{
    public ShellWindow(ShellViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;
    }
}
