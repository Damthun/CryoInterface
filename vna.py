import socket

VNA_PORT = 5025


def build_cmd(cmd: str) -> bytes:
    """
    Separated from send_cmd for clarity and ability to make send_cmd use socket.sendall
    :paramcmd: The command you'd like to send.
    :return: the command as a string.
    """
    cmd = cmd
    return cmd.encode('utf-8')


def send_cmd(s: socket.socket, cmd: str):
    """
    :param s: the VNA socket connection.
    :param cmd: the command you'd like to send.
    bytes_sent: uses socket.sendall to ensure all bytes are sent
    """
    cmd = cmd.encode('utf-8')
    bytes_sent = s.sendall(cmd)
    return


def receive_bytes(s: socket.socket):
    """
    Receive bytes from vna to host PC.
    #ABC #:start of transfer, A: Num figures in B. B: Number of bytes. C: Actual B data bytes.
    example #(A:5)(B:12345) (C: length of 12345 bytes)
    :param s: VNA socket connection.
    :return: Expected transmission size, transmission data
    """
    # ENA Transmits some empty info before # sometimes. this loop ensures we find the transmission start.
    check_header = s.recv(1)
    # print('Start :' + check_header.decode('utf-8'))
    while check_header.decode('utf-8') != '#':
        check_header = s.recv(1)
    # Once we find the start point.
    try:
        # A: Magnitude of transmitted data's size. i.e. 4 = 1000-9999 in bytes.
        bytes_number_of_digits_in_b = s.recv(1)

        # The magnitude (A) is converted from bytes to str.
        str_number_of_digits_in_b = bytes_number_of_digits_in_b.decode('utf-8')

        # Receive A amount of bytes, giving transmission length (B).
        bytes_transmission_length = s.recv(int(str_number_of_digits_in_b))

        # The transmission length (B) is converted from bytes to str.
        string_transmission_length = bytes_transmission_length.decode('utf-8')

        # Attempt to receive (B) bytes.
        data = s.recv(int(string_transmission_length))
        # Since recv doesn't usually get all bytes in one go, receive until size is comparable.
        while len(data) < int(string_transmission_length):
            data += s.recv(1024)
    except:
        return False
    return string_transmission_length, data
