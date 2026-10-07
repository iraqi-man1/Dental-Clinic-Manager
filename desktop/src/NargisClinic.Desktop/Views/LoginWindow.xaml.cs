using System.Windows;
using System.Windows.Controls;
using NargisClinic.Desktop.ViewModels;

namespace NargisClinic.Desktop.Views;

public partial class LoginWindow : Window
{
    private readonly LoginViewModel _viewModel;

    public LoginWindow(LoginViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        DataContext = viewModel;
    }

    private void PasswordInput_PasswordChanged(object sender, RoutedEventArgs e) =>
        _viewModel.Password = ((PasswordBox)sender).Password;
}
